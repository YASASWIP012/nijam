import { blobUrl } from "@/lib/github";
import type { Citation, CheckedClaim, RepoRef, Verdict } from "@/lib/types";
import { Defend } from "./Defend";

export const VERDICT_LABEL: Record<Verdict, string> = {
  implemented: "Backed by code",
  simulated: "Simulated",
  missing: "Not in the repo",
  unclear: "Not settled",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`verdict verdict--${verdict}`}>{VERDICT_LABEL[verdict]}</span>;
}

export function Cites({ citations, repo }: { citations: Citation[]; repo: RepoRef }) {
  return (
    <ul className="cites">
      {citations.map((cite) => (
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
  );
}

export function ClaimCard({
  claim,
  repo,
  reportId,
  nextLabel = "Say this instead",
}: {
  claim: CheckedClaim;
  repo: RepoRef;
  reportId?: string;
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
      {claim.onlySaid && <p className="claim__only">Only said out loud. The README never makes this claim.</p>}
      <p className="claim__reason">{claim.reason}</p>
      {claim.citations.length > 0 && <Cites citations={claim.citations} repo={repo} />}
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
      {reportId && claim.verdict !== "implemented" && <Defend reportId={reportId} claimId={claim.id} repo={repo} />}
    </li>
  );
}
