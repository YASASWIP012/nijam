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
          <li>Simulated also needs source lines, showing the fake path.</li>
          <li>Not in the repo is only allowed after every source file has been read.</li>
          <li>Anything else is marked not settled, and the page says why.</li>
          <li>Test counts come from counting the tests, without the model.</li>
        </ul>
        <h2>What it cannot do</h2>
        <p>
          It reads code and does not run it. It cannot prove a server was deployed or that a number was measured. A
          claim backed by code can still have bugs, so treat a verdict as a starting point for review.
        </p>
        <p>Your pitch and excerpts of the repo go to a third-party language model. Use public repos only.</p>
      </div>
    </main>
  );
}
