import { list, put } from "@vercel/blob";
import { SAMPLES } from "@/data/samples";
import type { Report } from "./types";

const path = (id: string) => `reports/${id}.json`;
const enabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function saveReport(report: Report): Promise<string | null> {
  if (!enabled()) return null;
  await put(path(report.id), JSON.stringify(report), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return `/r/${report.id}`;
}

export async function loadReport(id: string): Promise<Report | null> {
  const sample = SAMPLES.find((report) => report.id === id);
  if (sample) return sample;
  if (!enabled() || !/^[0-9a-f]{14}$/.test(id)) return null;
  const { blobs } = await list({ prefix: path(id), limit: 1 });
  const blob = blobs[0];
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "force-cache" });
  return res.ok ? ((await res.json()) as Report) : null;
}
