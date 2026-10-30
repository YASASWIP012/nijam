"use client";

import { useState } from "react";
import { RECEIPT_PUBLIC_KEY } from "@/lib/receipt-key";
import { honestPitch, receiptInput, sha256, whatIsRealMarkdown } from "@/lib/report";
import type { Report } from "@/lib/types";

const bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

async function verifySignature(receipt: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", bytes(RECEIPT_PUBLIC_KEY), "Ed25519", false, ["verify"]);
  return crypto.subtle.verify("Ed25519", key, bytes(signature), new TextEncoder().encode(receipt));
}

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
    if (!match) return setNote("Receipt does not match this page.");
    if (!report.signature) return setNote("Receipt matches this page, but it is not signed.");
    const signed = await verifySignature(report.receipt, report.signature);
    setNote(signed ? "Receipt matches and Nijam's signature is valid." : "Receipt matches, but the signature is not valid.");
  }

  return (
    <>
      <div className="report__actions">
        <button className="btn btn-candy btn-sm" onClick={download}>
          Download WHAT-IS-REAL.md
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => copy(honestPitch(report), "Copied.")}>
          {report.pitchSource === "instructions" ? "Copy what is left to do" : "Copy the honest pitch"}
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
