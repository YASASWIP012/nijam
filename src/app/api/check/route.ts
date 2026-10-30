import { loadRepo, RepoError } from "@/lib/github";
import { allow } from "@/lib/limit";
import { liveLlm, LlmError } from "@/lib/llm";
import { run } from "@/lib/pipeline";
import { saveReport } from "@/lib/store";
import type { RunEvent } from "@/lib/types";

export const maxDuration = 300;

const MIN_WORDS = 8;
const MAX_CHARS = 6000;

function refuse(message: string, status: number): Response {
  return Response.json({ message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { repo?: unknown; pitch?: unknown } | null;
  const repo = typeof body?.repo === "string" ? body.repo : "";
  const pitch = typeof body?.pitch === "string" ? body.pitch.trim() : "";
  if (pitch.split(/\s+/).length < MIN_WORDS) return refuse("Say a little more about what the project does.", 400);
  if (pitch.length > MAX_CHARS) return refuse("That is longer than a pitch. Keep it under a thousand words.", 400);
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(address)) return refuse("You have used this a lot in the last hour. Try again soon.", 429);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RunEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of run({ pitch, load: () => loadRepo(repo), llm: liveLlm() })) {
          if (event.type === "report") {
            send({ ...event, url: await saveReport(event.report).catch(() => null) });
          } else {
            send(event);
          }
        }
      } catch (error) {
        const known = error instanceof RepoError || error instanceof LlmError;
        if (!known) console.error(error);
        send({ type: "error", message: known ? error.message : "The check stopped partway. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
