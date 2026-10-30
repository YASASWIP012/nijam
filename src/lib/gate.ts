import { classify } from "./snapshot";
import type { CheckedClaim, Citation, Claim, Coverage, RawVerdict, RepoFacts, Verdict } from "./types";

const squash = (text: string) => text.replace(/\s+/g, " ").trim();
const LINE_SLACK = 4;
const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

/**
 * Finds the quote in the file near the lines given and returns the real line numbers.
 * Returns null for a quote that is not in the file: that citation does not count.
 */
export function confirmCitation(files: Map<string, string>, cited: Citation): Citation | null {
  const text = files.get(cited.path);
  const quote = squash(cited.quote);
  if (text === undefined || quote.length < 8) return null;
  const lines = text.split("\n");
  const from = Math.max(0, cited.startLine - 1 - LINE_SLACK);
  const to = Math.min(lines.length, cited.endLine + LINE_SLACK);
  const span = Math.max(1, cited.quote.split("\n").length);
  for (let size = span; size <= span + 2; size += 1) {
    for (let start = from; start < to && start + size <= lines.length; start += 1) {
      if (squash(lines.slice(start, start + size).join(" ")).includes(quote)) {
        return { path: cited.path, startLine: start + 1, endLine: start + size, quote: cited.quote };
      }
    }
  }
  return null;
}

/** Finds the words in the pitch. A claim nobody said is dropped. */
export function locateSaid(pitch: string, said: string): string | null {
  const bare = (text: string) => text.normalize("NFC").toLowerCase().replace(EDGE_PUNCTUATION, "");
  const target = squash(said).split(" ").map(bare).filter(Boolean);
  if (target.join(" ").length < 4) return null;
  const words = pitch.split(/\s+/).filter(Boolean);
  for (let start = 0; start + target.length <= words.length; start += 1) {
    const candidate = words.slice(start, start + target.length);
    if (candidate.every((word, index) => bare(word) === target[index])) return candidate.join(" ");
  }
  return null;
}

/** Compares a stated test count with the count taken from the code. */
export function checkTestCount(claim: Claim, facts: RepoFacts): CheckedClaim | null {
  const match = `${claim.claim} ${claim.said}`.match(/\b([\d,]+)\s*(?:\+\s*)?(?:unit |integration |automated )?tests?\b/i);
  if (!match?.[1]) return null;
  const stated = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(stated) || stated === 0) return null;
  const counted = facts.testCases;
  const near = counted >= stated * 0.9;
  return {
    ...claim,
    verdict: near ? "implemented" : "missing",
    reason: `You said ${stated} tests. The repo has ${counted} test cases, counted from the code.`,
    citations: [],
    sayInstead: near ? undefined : `The repo has ${counted} test cases.`,
  };
}

export interface GateContext {
  files: Map<string, string>;
  coverage: Coverage;
}

/**
 * The model proposes, this decides. Each verdict needs evidence that exists at this commit,
 * and "missing" is only allowed when every source file was read.
 */
export function applyGate(claim: Claim, raw: RawVerdict, ctx: GateContext): CheckedClaim {
  const citations = raw.citations
    .map((cited) => confirmCitation(ctx.files, cited))
    .filter((cited): cited is Citation => cited !== null);
  const inCode = citations.filter((cited) => classify(cited.path) === "source");

  let verdict: Verdict = raw.verdict;
  let why: string | null = null;
  if (raw.verdict === "implemented" && inCode.length === 0) {
    verdict = "unclear";
    why = citations.length
      ? "The only lines cited are in docs or tests, and a claim of working code needs code."
      : "No cited line exists in the repo at this commit.";
  } else if (raw.verdict === "simulated" && inCode.length === 0) {
    verdict = "unclear";
    why = "The fake path it pointed to could not be found in source files.";
  } else if (raw.verdict === "missing" && !ctx.coverage.complete) {
    verdict = "unclear";
    why = "Some source files were not read, so absence cannot be proven.";
  }

  return {
    ...claim,
    verdict,
    reason: raw.reason,
    citations,
    sayInstead: verdict === "implemented" || !raw.sayInstead.trim() ? undefined : raw.sayInstead.trim(),
    ...(why ? { overruled: { from: raw.verdict, why } } : {}),
  };
}
