import { byReadingOrder, classify, skipReason, type Snapshot } from "./snapshot";
import type { RepoRef } from "./types";

const MAX_FILE_BYTES = 200_000;
const MAX_TOTAL_BYTES = 5_000_000;
const CONCURRENCY = 20;

export class RepoError extends Error {}

export function parseRepoUrl(input: string): { owner: string; name: string } {
  const match = input
    .trim()
    .match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  if (!match?.[1] || !match[2]) {
    throw new RepoError("Use a public GitHub link, like github.com/owner/repo.");
  }
  return { owner: match[1], name: match[2] };
}

function headers(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "nijam",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: headers(), cache: "no-store" });
  if (res.status === 404) throw new RepoError("That repo is private or does not exist.");
  if (res.status === 403 || res.status === 429) {
    throw new RepoError("GitHub is rate limiting this site. Try again in a minute.");
  }
  if (!res.ok) throw new RepoError(`GitHub answered ${res.status}.`);
  return res.json() as Promise<T>;
}

async function inPool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}

export async function loadRepo(url: string): Promise<{ repo: RepoRef; snapshot: Snapshot }> {
  const { owner, name } = parseRepoUrl(url);
  const meta = await api<{ default_branch: string; private: boolean }>(`/repos/${owner}/${name}`);
  if (meta.private) throw new RepoError("That repo is private or does not exist.");
  const head = await api<{ sha: string }>(`/repos/${owner}/${name}/commits/${meta.default_branch}`);
  const tree = await api<{
    tree: { path: string; type: string; size?: number }[];
    truncated: boolean;
  }>(`/repos/${owner}/${name}/git/trees/${head.sha}?recursive=1`);

  const blobs = tree.tree.filter((item) => item.type === "blob");
  const skipped: Record<string, number> = {};
  const wanted: { path: string; size: number }[] = [];
  let sourceTooBig = false;
  for (const blob of blobs) {
    const size = blob.size ?? 0;
    const reason = skipReason(blob.path, size, MAX_FILE_BYTES);
    if (reason) {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
      if (reason === "over file size cap" && classify(blob.path) === "source") sourceTooBig = true;
    } else wanted.push({ path: blob.path, size });
  }

  let budget = MAX_TOTAL_BYTES;
  let complete = !tree.truncated && !sourceTooBig;
  const toRead: typeof wanted = [];
  for (const file of byReadingOrder(wanted)) {
    if (file.size > budget) {
      skipped["over repo size cap"] = (skipped["over repo size cap"] ?? 0) + 1;
      complete = false;
      continue;
    }
    budget -= file.size;
    toRead.push(file);
  }

  const files = new Map<string, string>();
  await inPool(toRead, CONCURRENCY, async ({ path }) => {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/${head.sha}/${encoded}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      skipped["could not be read"] = (skipped["could not be read"] ?? 0) + 1;
      complete = false;
      return;
    }
    const text = await res.text();
    if (text.includes("\u0000")) skipped.binary = (skipped.binary ?? 0) + 1;
    else files.set(path, text);
  });

  const bytes = [...files.values()].reduce((sum, text) => sum + text.length, 0);
  return {
    repo: { owner, name, sha: head.sha },
    snapshot: {
      files,
      coverage: { totalFiles: blobs.length, readFiles: files.size, bytes, skipped, complete },
    },
  };
}

export function blobUrl(repo: RepoRef, path: string, startLine: number, endLine: number): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const lines = startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
  return `https://github.com/${repo.owner}/${repo.name}/blob/${repo.sha}/${encoded}#${lines}`;
}
