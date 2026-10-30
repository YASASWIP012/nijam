import type { CheckedClaim, Report, Verdict } from "./types";

const VERDICT_ORDER: Verdict[] = ["implemented", "simulated", "missing", "unclear"];

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The exact bytes the receipt covers. Reports stay checkable in any browser. */
export function receiptInput(report: Pick<Report, "repo" | "pitch" | "claims">): string {
  return JSON.stringify({
    commit: `${report.repo.owner}/${report.repo.name}@${report.repo.sha}`,
    pitch: report.pitch,
    verdicts: report.claims.map((claim) => [claim.said, claim.verdict, claim.citations.map((c) => [c.path, c.startLine, c.endLine])]),
  });
}

export function countVerdicts(claims: CheckedClaim[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = { implemented: 0, simulated: 0, missing: 0, unclear: 0 };
  for (const claim of claims) counts[claim.verdict] += 1;
  return counts;
}

const HEADINGS: Record<Verdict, string> = {
  implemented: "Backed by code",
  simulated: "Simulated",
  missing: "Not in the repo",
  unclear: "Could not be settled",
};

/** A what-is-real document made only from checked verdicts. */
export function whatIsRealMarkdown(report: Report): string {
  const { owner, name, sha } = report.repo;
  const parts = [
    `# What is real in ${name}`,
    `Checked at commit \`${sha.slice(0, 12)}\` of ${owner}/${name}. Receipt \`${report.receipt.slice(0, 16)}\`.`,
  ];
  for (const verdict of VERDICT_ORDER) {
    const claims = report.claims.filter((claim) => claim.verdict === verdict);
    if (!claims.length) continue;
    parts.push(`## ${HEADINGS[verdict]}`);
    for (const claim of claims) {
      const cites = claim.citations.map((c) => `\`${c.path}:${c.startLine}\``).join(", ");
      parts.push(`- ${claim.claim} ${claim.reason}${cites ? ` (${cites})` : ""}`);
    }
  }
  return `${parts.join("\n\n")}\n`;
}

/** The pitch as the code supports it: backed claims kept, the rest replaced by honest lines. */
export function honestPitch(report: Report): string {
  return report.claims
    .map((claim) => (claim.verdict === "implemented" ? claim.said : claim.sayInstead))
    .filter((line): line is string => Boolean(line))
    .join(" ");
}
