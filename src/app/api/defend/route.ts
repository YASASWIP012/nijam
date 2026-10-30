import { loadRepo, RepoError } from "@/lib/github";
import { allow } from "@/lib/limit";
import { liveLlm, LlmError } from "@/lib/llm";
import { defendClaim } from "@/lib/pipeline";
import { loadReport } from "@/lib/store";

export const maxDuration = 120;

const MAX_CHARS = 700;

function refuse(message: string, status: number): Response {
  return Response.json({ message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { id?: unknown; claimId?: unknown; answer?: unknown } | null;
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (!answer) return refuse("Say something first.", 400);
  if (answer.length > MAX_CHARS) return refuse("That is longer than twenty seconds of talking.", 400);
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(address)) return refuse("You have used this a lot in the last hour. Try again soon.", 429);

  const report = typeof body?.id === "string" ? await loadReport(body.id) : null;
  const claim = report?.claims.find((item) => item.id === body?.claimId);
  if (!report || !claim) return refuse("That claim could not be found.", 404);
  if (claim.verdict === "implemented") return refuse("That claim is already backed by code.", 400);

  try {
    const { repo } = report;
    const { snapshot } = await loadRepo(`github.com/${repo.owner}/${repo.name}`, repo.sha);
    return Response.json({ claim: await defendClaim(claim, answer, snapshot, liveLlm()) });
  } catch (error) {
    if (error instanceof RepoError || error instanceof LlmError) return refuse(error.message, 502);
    console.error(error);
    return refuse("The check stopped partway. Please try again.", 500);
  }
}
