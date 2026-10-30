import { writeFileSync } from "node:fs";
import { loadRepo } from "@/lib/github";
import { liveLlm } from "@/lib/llm";
import { run } from "@/lib/pipeline";
import { signReceipt } from "@/lib/sign";
import type { Report } from "@/lib/types";

const REPOS = ["YASASWIP012/blindfetch", "YASASWIP012/proof-of-life", "YASASWIP012/check-the-receipt", "YASASWIP012/nijam"];

async function readmePitch(repo: string): Promise<string> {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`);
  const paragraphs = (await res.text())
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 60 && !/^[#|`<!\[-]/.test(part));
  return paragraphs.join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*`]/g, "").slice(0, 3000);
}

const reports: Report[] = [];
for (const name of REPOS) {
  const pitch = await readmePitch(name);
  for await (const event of run({
    pitch,
    pitchSource: "readme",
    llm: liveLlm(),
    load: () => loadRepo(`github.com/${name}`),
    sign: signReceipt,
  })) {
    if (event.type === "report") {
      reports.push(event.report);
      console.log(name, event.report.counts);
    }
  }
}
writeFileSync("src/data/samples.json", `${JSON.stringify(reports, null, 2)}\n`);
