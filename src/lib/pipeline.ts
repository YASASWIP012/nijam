import { applyGate, checkTestCount, locateSaid } from "./gate";
import type { Llm } from "./llm";
import { EXTRACT_SYSTEM, extractUser, VERIFY_SYSTEM, verifyUser } from "./prompts";
import { countVerdicts, receiptInput, sha256 } from "./report";
import { RepoIndex, signalsIn, type Chunk } from "./search";
import { factsOf, type Snapshot } from "./snapshot";
import { ExtractedClaims, RawVerdict, type CheckedClaim, type Claim, type RepoRef, type Report, type RunEvent } from "./types";

const MAX_CLAIMS = 10;
const CHUNKS_PER_CLAIM = 12;
const CONCURRENCY = 4;

export interface RunInput {
  pitch: string;
  load: () => Promise<{ repo: RepoRef; snapshot: Snapshot }>;
  llm: Llm;
}

export async function reportId(repo: RepoRef, pitch: string): Promise<string> {
  return (await sha256(`${repo.owner}/${repo.name}@${repo.sha}\n${pitch}`)).slice(0, 14);
}

export async function extractClaims(pitch: string, llm: Llm): Promise<Claim[]> {
  const { claims } = await llm.json({
    system: EXTRACT_SYSTEM,
    user: extractUser(pitch),
    schema: ExtractedClaims,
  });
  const kept: Claim[] = [];
  for (const claim of claims) {
    const said = locateSaid(pitch, claim.said);
    if (said && kept.length < MAX_CLAIMS) kept.push({ ...claim, said, id: `c${kept.length + 1}` });
  }
  return kept;
}

function evidenceFor(claim: Claim, index: RepoIndex): Chunk[] {
  const seen = new Set<string>();
  const merged: Chunk[] = [];
  const queries = [claim.terms.join(" "), `${claim.claim} ${claim.terms.join(" ")}`];
  for (const hits of queries.map((query) => index.search(query, CHUNKS_PER_CLAIM))) {
    for (const chunk of hits) {
      const key = `${chunk.path}:${chunk.startLine}`;
      if (!seen.has(key) && merged.length < CHUNKS_PER_CLAIM) {
        seen.add(key);
        merged.push(chunk);
      }
    }
  }
  return merged;
}

export async function checkClaim(
  claim: Claim,
  snapshot: Snapshot,
  index: RepoIndex,
  facts: Report["facts"],
  llm: Llm,
): Promise<CheckedClaim> {
  const counted = claim.kind === "metric" ? checkTestCount(claim, facts) : null;
  if (counted) return counted;

  const chunks = evidenceFor(claim, index);
  const signals = chunks.flatMap((chunk) => signalsIn(chunk).map((signal) => ({ path: chunk.path, signal })));
  const raw = await llm.json({
    system: VERIFY_SYSTEM,
    user: verifyUser(claim, chunks, signals, facts, snapshot.coverage),
    schema: RawVerdict,
  });
  return applyGate(claim, raw, { files: snapshot.files, coverage: snapshot.coverage });
}

export async function* run({ pitch, load, llm }: RunInput): AsyncGenerator<RunEvent> {
  yield { type: "stage", stage: "repo" };
  const { repo, snapshot } = await load();
  const facts = factsOf(snapshot.files);
  yield { type: "repo", repo };
  yield { type: "stage", stage: "claims", detail: `Read ${snapshot.coverage.readFiles} files at ${repo.sha.slice(0, 7)}` };

  const claims = await extractClaims(pitch, llm);
  yield { type: "claims", claims };
  yield { type: "stage", stage: "checking" };

  const index = new RepoIndex(snapshot.files);
  const checked: (CheckedClaim | undefined)[] = claims.map(() => undefined);
  const finished: CheckedClaim[] = [];
  const queue = claims.map((claim, position) => ({ claim, position }));
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const result = await checkClaim(next.claim, snapshot, index, facts, llm);
      checked[next.position] = result;
      finished.push(result);
    }
  });
  let settled = false;
  const all = Promise.all(workers).finally(() => {
    settled = true;
  });
  let sent = 0;
  while (!settled || sent < finished.length) {
    while (sent < finished.length) {
      const claim = finished[sent];
      sent += 1;
      if (claim) yield { type: "claim", claim };
    }
    if (!settled) await Promise.race([all, new Promise((resolve) => setTimeout(resolve, 150))]);
  }
  await all;

  const ordered = checked.filter((claim): claim is CheckedClaim => claim !== undefined);
  const base = { repo, pitch, claims: ordered };
  const report: Report = {
    ...base,
    id: await reportId(repo, pitch),
    createdAt: new Date().toISOString(),
    coverage: snapshot.coverage,
    facts,
    counts: countVerdicts(ordered),
    receipt: await sha256(receiptInput(base)),
  };
  yield { type: "stage", stage: "done" };
  yield { type: "report", report, url: null };
}
