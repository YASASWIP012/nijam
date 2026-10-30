import { z } from "zod";

export const VERDICTS = ["implemented", "simulated", "missing", "unclear"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const CLAIM_KINDS = ["feature", "metric", "integration", "data", "quality"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const ExtractedClaims = z.object({
  claims: z.array(
    z.object({
      said: z.string(),
      claim: z.string(),
      kind: z.enum(CLAIM_KINDS),
      terms: z.array(z.string()),
    }),
  ),
});
export type ExtractedClaims = z.infer<typeof ExtractedClaims>;

export const RawVerdict = z.object({
  verdict: z.enum(VERDICTS),
  reason: z.string(),
  citations: z.array(
    z.object({
      path: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      quote: z.string(),
    }),
  ),
  sayInstead: z.string(),
});
export type RawVerdict = z.infer<typeof RawVerdict>;

export interface Citation {
  path: string;
  startLine: number;
  endLine: number;
  quote: string;
}

export interface Claim {
  id: string;
  said: string;
  claim: string;
  kind: ClaimKind;
  terms: string[];
}

export interface CheckedClaim extends Claim {
  verdict: Verdict;
  reason: string;
  citations: Citation[];
  /** Set when code overruled the model. Holds what the model said first. */
  overruled?: { from: Verdict; why: string };
  sayInstead?: string;
}

export interface Coverage {
  totalFiles: number;
  readFiles: number;
  bytes: number;
  skipped: Record<string, number>;
  /** False when a size cap left source files unread, so "missing" cannot be proven. */
  complete: boolean;
}

export interface RepoFacts {
  sourceFiles: number;
  sourceLines: number;
  testFiles: number;
  testCases: number;
}

export interface RepoRef {
  owner: string;
  name: string;
  sha: string;
}

export type PitchSource = "spoken" | "instructions" | "readme" | "planted";

export interface Report {
  id: string;
  repo: RepoRef;
  pitch: string;
  pitchSource: PitchSource;
  createdAt: string;
  coverage: Coverage;
  facts: RepoFacts;
  claims: CheckedClaim[];
  /** Claims left out of the verdicts, shown on the report so nothing vanishes silently. */
  dropped: { notInPitch: number; overCap: number };
  counts: Record<Verdict, number>;
  /** SHA-256 over commit, pitch and every verdict. Changes if any of them change. */
  receipt: string;
  /** Ed25519 signature over the receipt, made by the Nijam server. */
  signature?: string;
}

export type RunEvent =
  | { type: "stage"; stage: "repo" | "claims" | "checking" | "done"; detail?: string }
  | { type: "repo"; repo: RepoRef }
  | { type: "claims"; claims: Claim[] }
  | { type: "claim"; claim: CheckedClaim }
  | { type: "report"; report: Report; url: string | null }
  | { type: "error"; message: string };
