import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export interface JsonRequest<S extends z.ZodType> {
  system: string;
  user: string;
  schema: S;
  effort?: "low" | "medium" | "high";
}

export interface Llm {
  json<S extends z.ZodType>(request: JsonRequest<S>): Promise<z.infer<S>>;
}

export class LlmError extends Error {}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_OUTPUT_TOKENS = 16000;
const GEMINI_RETRIES = 5;
const GEMINI_TIMEOUT_MS = 45_000;

interface GeminiStep {
  type: string;
  content?: { type: string; text?: string }[];
}

export function geminiText(body: { status?: string; steps?: GeminiStep[] }): string | null {
  if (body.status !== "completed") return null;
  const parts = (body.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "");
  return parts.join("") || null;
}

export function geminiLlm(
  apiKey: string,
  models: string[],
  { send = fetch, wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) } = {},
): Llm {
  /** A busy or rate-limited model hands over to the next one, so one overloaded model cannot stall a report. */
  async function call(body: (model: string) => string): Promise<Response | null> {
    let last: Response | null = null;
    for (let attempt = 0; attempt <= GEMINI_RETRIES; attempt += 1) {
      if (attempt > 0) await wait(2 ** attempt * 500 + Math.random() * 500);
      const model = models[attempt % models.length] as string;
      try {
        last = await send(GEMINI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: body(model),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        });
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
        last = null;
        continue;
      }
      if (last.status !== 429 && last.status !== 503) return last;
    }
    return last;
  }

  return {
    async json({ system, user, schema, effort = "medium" }) {
      const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema);
      const res = await call((model) =>
        JSON.stringify({
          model,
          system_instruction: system,
          input: user,
          store: false,
          generation_config: { thinking_level: effort, max_output_tokens: MAX_OUTPUT_TOKENS },
          response_format: { type: "text", mime_type: "application/json", schema: jsonSchema },
        }),
      );
      if (res === null) throw new LlmError("The model took too long. Try again in a minute.");
      if (res.status === 429) throw new LlmError("The checker has used its free quota for now. Try again later.");
      if (res.status === 503) throw new LlmError("The model is overloaded. Try again in a minute.");
      if (!res.ok) throw new LlmError(`The model answered ${res.status}.`);

      const text = geminiText(await res.json());
      if (text === null) throw new LlmError("The model returned an unreadable answer.");
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new LlmError("The model returned an unreadable answer.");
      }
      const checked = schema.safeParse(parsed);
      if (!checked.success) throw new LlmError("The model returned an unreadable answer.");
      return checked.data;
    },
  };
}

function anthropicLlm(apiKey: string, model: string): Llm {
  const client = new Anthropic({ apiKey, baseURL: "https://api.anthropic.com" });

  return {
    async json({ system, user, schema, effort = "medium" }) {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
        output_config: { effort, format: zodOutputFormat(schema) },
      } as never);
      const message = response as unknown as { stop_reason: string; parsed_output: z.infer<typeof schema> | null };
      if (message.stop_reason === "refusal") throw new LlmError("The model declined this input.");
      if (message.parsed_output === null) throw new LlmError("The model returned an unreadable answer.");
      return message.parsed_output;
    },
  };
}

export function liveLlm(): Llm {
  const apiKey = process.env.LLM_API_KEY;
  const models = process.env.LLM_MODEL?.split(",").map((name) => name.trim()).filter(Boolean) ?? [];
  const [first] = models;
  if (!apiKey || !first) throw new LlmError("The checker is not configured yet.");
  return process.env.LLM_PROVIDER === "gemini" ? geminiLlm(apiKey, models) : anthropicLlm(apiKey, first);
}
