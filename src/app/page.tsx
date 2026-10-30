import { Checker } from "@/components/Checker";
import { VerdictBadge } from "@/components/ClaimCard";
import { SAMPLES } from "@/data/samples";
import { VERDICTS } from "@/lib/types";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <h1>
            Say what you built. <span className="t-muted">See what the code backs up.</span>
          </h1>
          <p className="lead">
            Pitch your project out loud. Nijam splits it into claims, checks each one against the repo, and shows you
            the exact lines behind every verdict.
          </p>
          <div className="trust">
            <span>Public repos</span>
            <span>No account</span>
            <span>Built for Wispr Flow</span>
          </div>
          <Checker />
        </div>
      </section>

      {SAMPLES.length > 0 && (
        <section className="section section--alt" id="samples">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Real reports</span>
              <h2>Run on real projects.</h2>
              <p className="lead">Each report is pinned to a commit, so you can open the same lines we read.</p>
            </div>
            <div className="grid grid-3">
              {SAMPLES.map((report) => (
                <a className="card sample-card" href={`/r/${report.id}`} key={report.id}>
                  <p className="t-title">{report.repo.name}</p>
                  <p className="t-mono">{report.repo.sha.slice(0, 7)}</p>
                  <div className="tallyline">
                    {VERDICTS.filter((verdict) => report.counts[verdict] > 0).map((verdict) => (
                      <span key={verdict} style={{ display: "contents" }}>
                        <b>{report.counts[verdict]}</b>
                        <VerdictBadge verdict={verdict} />
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container split split--flip">
          <div>
            <span className="eyebrow">What I told my tools</span>
            <h3 style={{ marginTop: 14 }}>You asked for it out loud. Did it get built?</h3>
            <p className="lead">
              If you build by talking to a coding tool, your Flow history already holds every instruction you gave. Nijam
              checks them against the repo and tells you what to say next.
            </p>
          </div>
          <div className="window window--dark">
            <div className="window__bar">
              <span className="lights">
                <i />
                <i />
                <i />
              </span>
              <span className="window__title">Terminal</span>
            </div>
            <pre className="terminal">
              {`curl -O https://nijam-xi.vercel.app/history.mjs
node history.mjs --days 2`}
            </pre>
            <p className="terminal__note">
              Read-only and local. It prints your coding dictations and sends nothing anywhere. Flow's history file is
              undocumented, so an update can break it.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container split">
          <div>
            <span className="eyebrow">Why voice</span>
            <h3 style={{ marginTop: 14 }}>You can polish a README. It is harder to polish a sentence you just said.</h3>
            <p className="lead">
              Spoken pitches carry the claims you will repeat to a judge, a client or a teammate. Nijam checks those
              words, in the language you said them, before anyone else does.
            </p>
          </div>
          <div className="card card--flat">
            <p className="t-title">What you get</p>
            <ul className="checklist">
              <li>A verdict for each claim, with the lines behind it</li>
              <li>A rewrite for anything the code does not support</li>
              <li>A flag on every claim you said but never wrote down</li>
              <li>Twenty seconds to defend an unsettled claim out loud</li>
              <li>A WHAT-IS-REAL.md you can commit</li>
              <li>A signed receipt tied to one commit</li>
            </ul>
            <a className="btn btn-outline btn-sm" href="/how">
              How it decides
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
