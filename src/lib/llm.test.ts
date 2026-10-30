import { describe, expect, it } from "vitest";
import { z } from "zod";
import { geminiLlm, geminiText, LlmError } from "./llm";

const schema = z.object({ verdict: z.enum(["implemented", "missing"]) });
const request = { system: "rules", user: "claim", schema };
const answer = (text: string) => ({
  status: "completed",
  steps: [
    { type: "thought", content: [{ type: "text", text: "thinking" }] },
    { type: "model_output", content: [{ type: "text", text }] },
  ],
});
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

function scripted(...replies: Response[]) {
  const bodies: Record<string, unknown>[] = [];
  const send = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return replies.shift() ?? reply(500);
  }) as typeof fetch;
  return { send, bodies, wait: async () => {} };
}

describe("geminiText", () => {
  it("reads only model output", () => {
    expect(geminiText(answer("{}"))).toBe("{}");
  });

  it("refuses an unfinished answer", () => {
    expect(geminiText({ ...answer("{}"), status: "incomplete" })).toBeNull();
  });
});

describe("geminiLlm", () => {
  it("asks for storage off and sends the schema", async () => {
    const fake = scripted(reply(200, answer('{"verdict":"missing"}')));
    await expect(geminiLlm("k", ["m"], fake).json(request)).resolves.toEqual({ verdict: "missing" });
    const [body] = fake.bodies;
    expect(body).toMatchObject({ model: "m", store: false, system_instruction: "rules", input: "claim" });
    expect(body?.response_format).toMatchObject({ mime_type: "application/json" });
    expect(JSON.stringify(body?.response_format)).not.toContain("$schema");
  });

  it("retries a rate limit, then succeeds", async () => {
    const fake = scripted(reply(429), reply(503), reply(200, answer('{"verdict":"implemented"}')));
    await expect(geminiLlm("k", ["m"], fake).json(request)).resolves.toEqual({ verdict: "implemented" });
    expect(fake.bodies).toHaveLength(3);
  });

  it("stops retrying and says the quota ran out", async () => {
    const fake = scripted(...Array.from({ length: 6 }, () => reply(429)));
    await expect(geminiLlm("k", ["m"], fake).json(request)).rejects.toThrow(/free quota/);
    expect(fake.bodies).toHaveLength(6);
  });

  it("moves to the next model when one is busy", async () => {
    const fake = scripted(reply(503), reply(200, answer('{"verdict":"missing"}')));
    await geminiLlm("k", ["busy", "free"], fake).json(request);
    expect(fake.bodies.map((body) => body.model)).toEqual(["busy", "free"]);
  });

  it("moves on when a call times out", async () => {
    const calls: string[] = [];
    const send = (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)).model);
      if (calls.length === 1) throw Object.assign(new Error("slow"), { name: "TimeoutError" });
      return reply(200, answer('{"verdict":"missing"}'));
    }) as typeof fetch;
    await geminiLlm("k", ["slow", "fast"], { send, wait: async () => {} }).json(request);
    expect(calls).toEqual(["slow", "fast"]);
  });

  it("does not retry a bad key", async () => {
    const fake = scripted(reply(403));
    await expect(geminiLlm("k", ["m"], fake).json(request)).rejects.toThrow(LlmError);
    expect(fake.bodies).toHaveLength(1);
  });

  it("rejects an answer that breaks the schema", async () => {
    const fake = scripted(reply(200, answer('{"verdict":"maybe"}')));
    await expect(geminiLlm("k", ["m"], fake).json(request)).rejects.toThrow(/unreadable/);
  });

  it("rejects text that is not JSON", async () => {
    const fake = scripted(reply(200, answer("Sure! Here it is.")));
    await expect(geminiLlm("k", ["m"], fake).json(request)).rejects.toThrow(/unreadable/);
  });
});
