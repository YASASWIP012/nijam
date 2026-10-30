"use client";

import { useRef, useState } from "react";
import { honestPitch } from "@/lib/report";
import type { CheckedClaim, Claim, RepoRef, Report, RunEvent } from "@/lib/types";
import { SAMPLES } from "@/data/samples";
import { ClaimCard } from "./ClaimCard";
import { ReportView } from "./ReportView";

const STAGES = [
  ["repo", "Reading the repo"],
  ["claims", "Finding your claims"],
  ["checking", "Checking each one"],
  ["done", "Done"],
] as const;

export function Checker() {
  const [mode, setMode] = useState<"spoken" | "instructions">("spoken");
  const [repo, setRepo] = useState("");
  const [pitch, setPitch] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [pending, setPending] = useState<Claim[]>([]);
  const [checked, setChecked] = useState<CheckedClaim[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [checkedRepo, setCheckedRepo] = useState<RepoRef | null>(null);
  const [error, setError] = useState("");
  const results = useRef<HTMLDivElement>(null);
  const voice = useRef<HTMLTextAreaElement>(null);
  const busy = stage !== null && stage !== "done";
  const words = pitch.trim() ? pitch.trim().split(/\s+/).length : 0;

  function apply(event: RunEvent) {
    if (event.type === "stage") {
      setStage(event.stage);
      if (event.detail) setDetail(event.detail);
    } else if (event.type === "repo") {
      setCheckedRepo(event.repo);
    } else if (event.type === "claims") {
      setPending(event.claims);
    } else if (event.type === "claim") {
      setChecked((done) => [...done, event.claim]);
    } else if (event.type === "report") {
      setReport(event.report);
      if (event.url) window.history.replaceState(null, "", event.url);
    } else {
      setError(event.message);
      setStage(null);
    }
  }

  async function check(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setReport(null);
    setChecked([]);
    setPending([]);
    setDetail("");
    setStage("repo");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, pitch, mode }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "The check could not start.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line) apply(JSON.parse(line) as RunEvent);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The check stopped.");
      setStage(null);
    }
  }

  function loadExample() {
    const sample = SAMPLES[0];
    if (!sample) return;
    setRepo(`github.com/${sample.repo.owner}/${sample.repo.name}`);
    setPitch(sample.pitch);
  }

  function sayItAgain() {
    if (report) setPitch(honestPitch(report));
    setStage(null);
    setReport(null);
    voice.current?.focus();
  }

  return (
    <div className="tool" id="check">
      <form className="tool__card" onSubmit={check}>
        <div className="segmented" role="group" aria-label="What to check" style={{ marginBottom: 18 }}>
          <button type="button" aria-pressed={mode === "spoken"} onClick={() => setMode("spoken")}>
            My pitch
          </button>
          <button type="button" aria-pressed={mode === "instructions"} onClick={() => setMode("instructions")}>
            What I told my tools
          </button>
        </div>
        <label className="field">
          <span className="field__label">Public GitHub repo</span>
          <input
            className="input"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            placeholder="github.com/you/your-project"
            spellCheck={false}
            autoCapitalize="none"
            required
          />
        </label>
        <label className="field">
          <span className="field__label">
            {mode === "spoken" ? "Explain it out loud" : "Your dictated instructions"}
            <span className="field__hint">English, हिन्दी or తెలుగు</span>
          </span>
          <textarea
            ref={voice}
            className="voice"
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
            placeholder={
              mode === "spoken"
                ? "Click here, hold your Wispr Flow key and pitch the project as you would to a judge. What does it do? What is real? What numbers would you quote?"
                : "Paste what you dictated to your coding tools, or say what you asked them to build. Nijam checks each instruction against the repo."
            }
            required
          />
        </label>
        <div className="tool__foot">
          <span className="status">
            {words > 0 ? `${words} words` : "No Flow? Your phone's keyboard mic works too."}
            {words === 0 && SAMPLES[0] && (
              <>
                {" "}
                <button type="button" className="linklike" onClick={loadExample}>
                  Load an example
                </button>
              </>
            )}
          </span>
          <button className="btn btn-candy" type="submit" disabled={busy}>
            {busy ? "Checking" : "Check my claims"}
          </button>
        </div>
        {stage && (
          <ol className="stages" aria-label="Progress">
            {STAGES.map(([key, label]) => (
              <li key={key} data-on={key === stage}>
                {label}
              </li>
            ))}
          </ol>
        )}
        {detail && <p className="status" style={{ marginTop: 10 }}>{detail}</p>}
        <p className="status status--error" role="alert" style={{ marginTop: error ? 10 : 0 }}>
          {error}
        </p>
      </form>
      <div ref={results} aria-live="polite" style={{ marginTop: 24 }}>
        {report ? (
          <>
            <ReportView report={report} />
            {mode === "spoken" && (
              <button className="btn btn-ink" style={{ marginTop: 20 }} onClick={sayItAgain}>
                Say it again, honestly
              </button>
            )}
          </>
        ) : (
          checkedRepo &&
          checked.length > 0 && (
            <ul className="claims">
              {checked.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} repo={checkedRepo} />
              ))}
            </ul>
          )
        )}
        {!report && pending.length > checked.length && (
          <p className="status" style={{ marginTop: 12 }}>
            {checked.length} of {pending.length} claims checked.
          </p>
        )}
      </div>
    </div>
  );
}
