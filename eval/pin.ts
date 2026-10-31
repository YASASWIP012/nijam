import { readFileSync, writeFileSync } from "node:fs";
import { list } from "@vercel/blob";
import { onlySaid } from "@/lib/gate";
import { loadRepo } from "@/lib/github";
import type { CheckedClaim, Report } from "@/lib/types";

const id = process.argv[2];
const { blobs } = await list({ prefix: `reports/${id}.json`, limit: 1 });
if (!blobs[0]) throw new Error("no such report");
const report = (await (await fetch(blobs[0].url)).json()) as Report;
const { snapshot } = await loadRepo(`github.com/${report.repo.owner}/${report.repo.name}`, report.repo.sha);
const claims: CheckedClaim[] = report.claims.map(({ onlySaid: _, ...claim }) =>
  onlySaid(claim, snapshot.files) ? { ...claim, onlySaid: true } : claim,
);
const path = "src/data/samples.json";
const samples = (JSON.parse(readFileSync(path, "utf8")) as Report[]).filter((item) => item.id !== id);
writeFileSync(path, `${JSON.stringify([{ ...report, claims }, ...samples], null, 2)}\n`);
console.log(report.repo.name, report.pitchSource, report.counts, claims.filter((claim: CheckedClaim) => claim.onlySaid).map((claim) => claim.said));
