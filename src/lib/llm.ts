import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

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

export function liveLlm(): Llm {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!apiKey || !model) throw new LlmError("The checker is not configured yet.");
  const client = new Anthropic({ apiKey, baseURL: "https://api.anthropic.com" });

  return {
    async json({ system, user, schema, effort = "medium" }) {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
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
