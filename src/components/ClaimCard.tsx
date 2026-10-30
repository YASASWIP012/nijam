import { blobUrl } from "@/lib/github";
import type { CheckedClaim, RepoRef, Verdict } from "@/lib/types";

export const VERDICT_LABEL: Record<Verdict, string> = {
  implemented: "Backed by code",
  simulated: "Simulated",
  missing: "Not in the repo",
  unclear: "Not settled",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`verdict verdict--${verdict}`}>{VERDICT_LABEL[verdict]}</span>;
}

export function ClaimCard({
  claim,
  repo,
  nextLabel = "Say this instead",
}: {
  claim: CheckedClaim;
  repo: RepoRef;
  nextLabel?: string;
}) {
  return (
    <li className="claim">
      <div className="claim__top">
        <div>
          <p className="claim__said">“{claim.said}”</p>
          <p className="claim__meaning">{claim.claim}</p>
        </div>
        <VerdictBadge verdict={claim.verdict} />
      </div>
      <p className="claim__reason">{claim.reason}</p>
      {claim.citations.length > 0 && (
        <ul className="cites">
          {claim.citations.map((cite) => (
            <li className="cite" key={`${cite.path}:${cite.startLine}`}>
              <a href={blobUrl(repo, cite.path, cite.startLine, cite.endLine)} target="_blank" rel="noreferrer">
                <span className="cite__path">
                  {cite.path}:{cite.startLine}
                </span>
                <code>{cite.quote}</code>
              </a>
            </li>
          ))}
        </ul>
      )}
      {claim.overruled && (
        <p className="claim__overruled">
          The model said {VERDICT_LABEL[claim.overruled.from].toLowerCase()}. {claim.overruled.why}
        </p>
      )}
      {claim.sayInstead && (
        <p className="claim__instead">
          <b>{nextLabel}</b>
          {claim.sayInstead}
        </p>
      )}
    </li>
  );
}
