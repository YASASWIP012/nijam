import { tokenize } from "./search";
import { classify } from "./snapshot";
import type { CheckedClaim, Citation, Claim, Coverage, RawVerdict, RepoFacts, Verdict } from "./types";

const squash = (text: string) => text.replace(/\s+/g, " ").trim();
const LINE_SLACK = 4;
const COMMENT_LINE = /^\s*(\/\/|#(?![!\[])|\*|\/\*|--|"""|\'\'\'|<!--)/;
const IMPORT_LINE = /^\s*(import\b|from\s+\S+\s+import\b|export\s+\*\s+from\b|(const|let|var)\s+.+=\s*require\(|use\s+[\w:]+|#include\b|package\b)/;
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

/** True when a quote has a line that does something: comments and imports prove nothing. */
export function hasLiveCode(quote: string): boolean {
  return quote.split("\n").some((line) => line.trim() !== "" && !COMMENT_LINE.test(line) && !IMPORT_LINE.test(line));
}

/**
 * A repo-wide search for the claim's own words. If a source file holds most of them,
 * something related exists, and "not in the repo" would overstate it.
 */
export function absenceHolds(claim: Claim, files: Map<string, string>): boolean {
  const terms = stems(claim);
  if (terms.length === 0) return false;
  const needed = termsNeeded(terms);
  for (const [path, text] of files) {
    if (classify(path) !== "source") continue;
    if (matchedTerms(terms, text) >= needed) return false;
  }
  return true;
}

/** Search terms cut to their stem, so "hashed" finds "hash" and "reminders" finds "reminder". */
function stems(claim: Claim): string[] {
  const words = claim.terms.flatMap(tokenize).filter((term) => term.length >= 4);
  return [...new Set(words.map((term) => term.replace(/(ing|ed|es|s)$/, "")))];
}

const termsNeeded = (terms: string[]) => (terms.length === 1 ? 1 : Math.max(2, Math.ceil(terms.length * 0.6)));

function matchedTerms(terms: string[], text: string): number {
  const tokens = [...new Set(tokenize(text))];
  return terms.filter((term) => tokens.some((token) => token.startsWith(term))).length;
}

/** True for a claim the README never makes: the speaker only said it out loud. */
export function onlySaid(claim: Claim, files: Map<string, string>): boolean {
  const readme = [...files].find(([path]) => /^readme\.[a-z]+$/i.test(path))?.[1];
  const terms = stems({ ...claim, terms: [...claim.terms, claim.said] });
  if (readme === undefined || terms.length === 0) return false;
  return matchedTerms(terms, readme) < termsNeeded(terms);
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

/** A measured number needs to appear in the code cited, on a line about the claim. An unrelated constant proves nothing. */
export function numbersInCode(claim: Claim, cited: Citation[]): boolean {
  if (claim.kind !== "metric") return true;
  const plain = (text: string) => text.replaceAll(",", "");
  const numbers = plain(claim.claim).match(/\d+(?:\.\d+)?/g) ?? [];
  const lines = plain(cited.map((item) => item.quote).join("\n")).split("\n");
  const terms = stems(claim);
  return numbers.every((number) => {
    const exact = new RegExp(`(^|[^\\d.])${number.replace(".", "\\.")}(?![\\d])`);
    return lines.some((line) => exact.test(line) && (terms.length === 0 || matchedTerms(terms, line) > 0));
  });
}

/** A rewrite has to stay in the speaker's language. Script letters the speaker never used mean the model drifted. */
export function keepsLanguage(said: string, rewrite: string): boolean {
  const scripts = (text: string) => new Set(text.match(/\p{L}/gu)?.map(scriptOf));
  const spoken = scripts(said);
  return [...scripts(rewrite)].every((script) => script === "Latin" || spoken.has(script));
}

function scriptOf(letter: string): string {
  const names = ["Latin", "Devanagari", "Telugu"] as const;
  return names.find((name) => new RegExp(`\\p{Script=${name}}`, "u").test(letter)) ?? "Other";
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
  const inCode = citations.filter((cited) => classify(cited.path) === "source" && hasLiveCode(cited.quote));

  let verdict: Verdict = raw.verdict;
  let why: string | null = null;
  if (raw.verdict === "implemented" && inCode.length === 0) {
    verdict = "unclear";
    why = citations.length
      ? "The lines cited are docs, tests, comments or imports, and a claim of working code needs running code."
      : "No cited line exists in the repo at this commit.";
  } else if (raw.verdict === "implemented" && !numbersInCode(claim, inCode)) {
    verdict = "unclear";
    why = "The cited code does not contain this number, so it cannot show the number was measured.";
  } else if (raw.verdict === "simulated" && inCode.length === 0) {
    verdict = "unclear";
    why = "The fake path it pointed to could not be found in source files.";
  } else if (raw.verdict === "missing" && claim.kind === "metric") {
    verdict = "unclear";
    why = "Reading code cannot show that a number is false, only that nothing here proves it.";
  } else if (raw.verdict === "missing" && !ctx.coverage.complete) {
    verdict = "unclear";
    why = "Some source files were not read, so absence cannot be proven.";
  } else if (raw.verdict === "missing" && !absenceHolds(claim, ctx.files)) {
    verdict = "unclear";
    why = "A search of the whole repo found source files using these words, so it may exist in another form.";
  }

  return {
    ...claim,
    verdict,
    reason: raw.reason,
    citations,
    sayInstead:
      verdict === "implemented" || !raw.sayInstead.trim() || !keepsLanguage(claim.said, raw.sayInstead)
        ? undefined
        : raw.sayInstead.trim(),
    ...(why ? { overruled: { from: raw.verdict, why } } : {}),
  };
}
