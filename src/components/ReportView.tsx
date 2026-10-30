import { VERDICTS, type Report } from "@/lib/types";
import { ClaimCard, VERDICT_LABEL } from "./ClaimCard";
import { ReportActions } from "./ReportActions";

const SOURCE_NOTE: Record<Report["pitchSource"], string> = {
  spoken: "Checked against what the author said.",
  instructions: "Checked against instructions dictated to a coding tool.",
  readme: "This pitch was taken from the project's README, not dictated.",
  planted: "A test repo with planted claims.",
};

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
      <p className="report__meta">{SOURCE_NOTE[report.pitchSource]}</p>
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
          <ClaimCard
            key={claim.id}
            claim={claim}
            repo={repo}
            nextLabel={report.pitchSource === "instructions" ? "Tell your tool this next" : undefined}
          />
        ))}
      </ul>
      <div className="receipt">
        <p>
          Receipt <code>{report.receipt}</code>
        </p>
        <p style={{ marginTop: 6 }}>
          This hash covers the commit, the spoken pitch and every verdict.
          {skipped.length > 0 && ` Files left out: ${skipped.map(([why, count]) => `${count} ${why}`).join(", ")}.`}
          {report.dropped.overCap > 0 && ` ${report.dropped.overCap} more claims were past the limit and not checked.`}
          {report.dropped.notInPitch > 0 && ` ${report.dropped.notInPitch} claims were dropped because the words were not in the text.`}
        </p>
      </div>
    </>
  );
}
