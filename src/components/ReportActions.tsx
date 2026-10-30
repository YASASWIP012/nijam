"use client";

import { useState } from "react";
import { honestPitch, receiptInput, sha256, whatIsRealMarkdown } from "@/lib/report";
import type { Report } from "@/lib/types";

export function ReportActions({ report }: { report: Report }) {
  const [note, setNote] = useState("");

  async function copy(text: string, done: string) {
    await navigator.clipboard.writeText(text);
    setNote(done);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([whatIsRealMarkdown(report)], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "WHAT-IS-REAL.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function verify() {
    const match = (await sha256(receiptInput(report))) === report.receipt;
    setNote(match ? "Receipt matches this page. Nothing here was changed." : "Receipt does not match this page.");
  }

  return (
    <>
      <div className="report__actions">
        <button className="btn btn-candy btn-sm" onClick={download}>
          Download WHAT-IS-REAL.md
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => copy(honestPitch(report), "Honest pitch copied.")}>
          Copy the honest pitch
        </button>
        <button className="btn btn-outline btn-sm" onClick={verify}>
          Check the receipt
        </button>
      </div>
      <p className="status" role="status" style={{ marginTop: 10 }}>
        {note}
      </p>
    </>
  );
}
