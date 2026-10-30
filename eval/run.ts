import { writeFileSync, mkdirSync } from "node:fs";
import { liveLlm } from "@/lib/llm";
import { run } from "@/lib/pipeline";
import { snapshotFrom } from "@/lib/snapshot";
import type { Report } from "@/lib/types";
import { CASES, PITCH, REPO } from "./labelled";

const repo = { owner: "eval", name: "quickbill", sha: "0000000000000000" };
let report: Report | null = null;
for await (const event of run({ pitch: PITCH, pitchSource: "planted", llm: liveLlm(), load: async () => ({ repo, snapshot: snapshotFrom(REPO) }) })) {
  if (event.type === "report") report = event.report;
}
if (!report) throw new Error("no report");

let right = 0;
const rows = CASES.map((item) => {
  const found = report!.claims.find((claim) => claim.said.toLowerCase().includes(item.said.slice(0, 18).toLowerCase()));
  const verdict = found?.verdict ?? "not extracted";
  if (verdict === item.label) right += 1;
  return { said: item.said, label: item.label, verdict, overruled: found?.overruled?.from ?? null };
});
mkdirSync("eval/out", { recursive: true });
writeFileSync("eval/out/labelled.json", JSON.stringify({ right, total: CASES.length, rows, report }, null, 2));
console.table(rows);
console.log(`${right} of ${CASES.length} correct`);
