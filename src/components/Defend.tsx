"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckedClaim, RepoRef } from "@/lib/types";
import { Cites, VerdictBadge } from "./ClaimCard";

const SECONDS = 20;
const GRACE = 6;

export function Defend({ reportId, claimId, repo }: { reportId: string; claimId: string; repo: RepoRef }) {
  const [phase, setPhase] = useState<"idle" | "talking" | "checking" | "done">("idle");
  const [left, setLeft] = useState(SECONDS);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckedClaim | null>(null);
  const [error, setError] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(answer);
  latest.current = answer;

  async function send() {
    const text = latest.current.trim();
    if (!text) {
      setPhase("idle");
      setError("Nothing came through. Try again.");
      return;
    }
    setPhase("checking");
    try {
      const res = await fetch("/api/defend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, claimId, answer: text }),
      });
      const body = (await res.json()) as { claim?: CheckedClaim; message?: string };
      if (!res.ok || !body.claim) throw new Error(body.message ?? "The check stopped.");
      setResult(body.claim);
      setPhase("done");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The check stopped.");
      setPhase("idle");
    }
  }

  useEffect(() => {
    if (phase !== "talking") return;
    box.current?.focus();
    const timer = setInterval(() => setLeft((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "talking" && left <= -GRACE) void send();
  });

  if (phase === "idle") {
    return (
      <div className="defend">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            setLeft(SECONDS);
            setAnswer("");
            setError("");
            setPhase("talking");
          }}
        >
          Defend this out loud
        </button>
        {error && <p className="status status--error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="defend">
      {phase === "talking" && (
        <>
          <p className="defend__clock" aria-live="off">
            {left > 0 ? `${left}s. Say where in the code this happens.` : "Time. Release your key."}
          </p>
          <textarea
            ref={box}
            className="voice"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Hold your Flow key and answer as you would to a judge."
          />
          <div className="defend__foot">
            <span className="status">Your answer tells Nijam where to look. Only the code can settle it.</span>
            <button type="button" className="btn btn-candy btn-sm" onClick={() => void send()} disabled={!answer.trim()}>
              Check my answer
            </button>
          </div>
        </>
      )}
      {phase === "checking" && <p className="status">Checking the code again.</p>}
      {phase === "done" && result && (
        <div className="defend__result">
          <p className="claim__said">“{answer.trim()}”</p>
          <VerdictBadge verdict={result.verdict} />
          <p className="claim__reason">{result.reason}</p>
          {result.citations.length > 0 && <Cites citations={result.citations} repo={repo} />}
          <p className="status">The report keeps its first verdict. This answer shows here only.</p>
        </div>
      )}
    </div>
  );
}
