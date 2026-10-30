import { VERDICTS, type Report } from "@/lib/types";
import { ClaimCard, VERDICT_LABEL } from "./ClaimCard";
import { ReportActions } from "./ReportActions";

export function ReportView({ report }: { report: Report }) {
  const { repo, coverage, facts } = report;
  const skipped = Object.entries(coverage.skipped);
  return (
    <>
      <span className="eyebrow">
        <span className="dot" />
        Claim check
      </span>
      <h1 className="t-h2" style={{ marginTop: 12 }}>
        {repo.owner}/{repo.name}
      </h1>
      <p className="report__meta">
        Commit <span className="t-mono">{repo.sha.slice(0, 12)}</span>. Read {coverage.readFiles} of {coverage.totalFiles}{" "}
        files. {facts.sourceFiles} source files, {facts.testCases} test cases.
        {!coverage.complete && " Some source files were not read, so nothing is marked as missing."}
      </p>
      <div className="tally">
        {VERDICTS.map((verdict) => (
          <div key={verdict}>
            <b>{report.counts[verdict]}</b>
            <span>{VERDICT_LABEL[verdict]}</span>
          </div>
        ))}
      </div>
      <ReportActions report={report} />
      <h2>What was said, and what the code shows</h2>
      <ul className="claims">
        {report.claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} repo={repo} />
        ))}
      </ul>
      <div className="receipt">
        <p>
          Receipt <code>{report.receipt}</code>
        </p>
        <p style={{ marginTop: 6 }}>
          This hash covers the commit, the spoken pitch and every verdict.
          {skipped.length > 0 && ` Left out: ${skipped.map(([why, count]) => `${count} ${why}`).join(", ")}.`}
        </p>
      </div>
    </>
  );
}
