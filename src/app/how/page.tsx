import { RECEIPT_PUBLIC_KEY } from "@/lib/receipt-key";

export const metadata = { title: "How Nijam decides" };

export default function How() {
  return (
    <main className="report">
      <div className="container prose">
        <h1 className="t-h2">How it decides.</h1>
        <p className="lead" style={{ marginTop: 14 }}>
          A model reads the code. Plain code decides whether its answer counts.
        </p>
        <h2>The rules</h2>
        <ul>
          <li>A claim only exists if its words are in what you said.</li>
          <li>A citation only counts if the quoted lines are in the file at that commit.</li>
          <li>Backed by code needs lines in a source file. READMEs and tests do not count.</li>
          <li>A measured number has to appear in the code cited. If it does not, the claim stays not settled, because code cannot show a number was measured.</li>
          <li>A number is never marked as not in the repo. Reading code cannot show a number is false.</li>
          <li>Simulated also needs source lines, showing the fake path.</li>
          <li>A claim is marked as only said out loud when most of its search terms are not in the README.</li>
          <li>When you defend a claim, your answer tells the search where to look. It cannot settle the verdict, and every rule above still applies.</li>
          <li>Comments and imports do not count as code.</li>
          <li>Not in the repo needs every source file fetched and a repo-wide search for the claim's words to find nothing.</li>
          <li>The first report for a commit and pitch stands. Running it again returns the same report.</li>
          <li>Anything else is marked not settled, and the page says why.</li>
          <li>Test counts come from counting the tests, without the model. Skipped and commented-out tests are left out.</li>
          <li>Claims past the limit, and claims the text does not contain, are counted on the report.</li>
        </ul>
        <h2>What it cannot do</h2>
        <p>
          It reads code and does not run it. It cannot prove a server was deployed or that a number was measured. The
          rules confirm that a quote exists at that commit. They cannot confirm the model read it correctly, or that the
          code is ever called, so dead code can pass. The model sees up to twelve excerpts for each claim, chosen by
          search. Treat a verdict as a starting point for review.
        </p>
        <p>Your pitch and excerpts of the repo go to a third-party language model on a free plan, and the provider may use them to improve its products. Use public repos only, and keep private details out of what you say.</p>
        <h2>How it was tested</h2>
        <p>
          On a planted repo with 11 hand-labelled claims, the latest run got 9 right. It skipped one claim and left one real
          feature not settled. The rules overruled the model once, on a speed number it called missing. Scores move between
          runs: earlier ones were 9 of 10 and 8 of 11. The repo and the labels are in <span className="t-mono">eval/labelled.ts</span>.
        </p>
        <p>The free plan covers a handful of checks a day. When they run out, the real reports stay open.</p>
        <h2>Receipts</h2>
        <p>
          A receipt is a SHA-256 hash of the commit, the text and the verdicts, signed with Ed25519. It shows that Nijam
          issued this report. It does not make the verdicts true. The public key is{" "}
          <span className="t-mono">{RECEIPT_PUBLIC_KEY}</span>
        </p>
      </div>
    </main>
  );
}
