import { classify, type FileKind } from "./snapshot";

export interface Chunk {
  path: string;
  kind: FileKind;
  startLine: number;
  endLine: number;
  text: string;
}

const CHUNK_LINES = 60;
const OVERLAP = 15;
const K1 = 1.4;
const B = 0.75;
const KIND_WEIGHT: Record<FileKind, number> = { source: 1.3, test: 0.8, doc: 0.7, config: 0.8, fixture: 0.6 };

export function tokenize(text: string): string[] {
  return (
    text
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? []
  );
}

export function chunkFile(path: string, text: string): Chunk[] {
  const lines = text.split("\n");
  const kind = classify(path);
  const chunks: Chunk[] = [];
  for (let start = 0; start < lines.length; start += CHUNK_LINES - OVERLAP) {
    const end = Math.min(start + CHUNK_LINES, lines.length);
    chunks.push({ path, kind, startLine: start + 1, endLine: end, text: lines.slice(start, end).join("\n") });
    if (end === lines.length) break;
  }
  return chunks;
}

/** BM25 over line chunks. Code outranks prose, so a README cannot stand in for an implementation. */
export class RepoIndex {
  private chunks: { chunk: Chunk; freq: Map<string, number>; length: number }[] = [];
  private docFreq = new Map<string, number>();
  private avgLength = 1;

  constructor(files: Map<string, string>) {
    let total = 0;
    for (const [path, text] of files) {
      for (const chunk of chunkFile(path, text)) {
        const tokens = tokenize(`${path} ${chunk.text}`);
        const freq = new Map<string, number>();
        for (const token of tokens) freq.set(token, (freq.get(token) ?? 0) + 1);
        for (const token of freq.keys()) this.docFreq.set(token, (this.docFreq.get(token) ?? 0) + 1);
        this.chunks.push({ chunk, freq, length: tokens.length });
        total += tokens.length;
      }
    }
    this.avgLength = Math.max(1, total / Math.max(1, this.chunks.length));
  }

  search(query: string, limit: number): Chunk[] {
    const terms = [...new Set(tokenize(query))];
    const size = this.chunks.length;
    const scored = this.chunks.map((entry) => {
      let score = 0;
      for (const term of terms) {
        const tf = entry.freq.get(term);
        if (!tf) continue;
        const df = this.docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (size - df + 0.5) / (df + 0.5));
        score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * entry.length) / this.avgLength));
      }
      return { chunk: entry.chunk, score: score * KIND_WEIGHT[entry.chunk.kind] };
    });
    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.chunk);
  }
}

export interface Signal {
  label: string;
  line: number;
  text: string;
}

const SIGNALS: [string, RegExp][] = [
  ["unfinished", /\b(TODO|FIXME|XXX|HACK|not implemented|unimplemented|coming soon)\b/i],
  ["fake data", /\b(mock|fake|stub|dummy|placeholder|hard-?coded|canned|simulat\w*)\b/i],
  ["random value", /\b(Math\.random|random\.random|rand\(\))/],
  ["fake delay", /setTimeout\(|\bsleep\(/],
];

/** Lines that often mean a demo stands in for the real thing. Hints for review, never a verdict. */
export function signalsIn(chunk: Chunk): Signal[] {
  if (chunk.kind !== "source") return [];
  const found: Signal[] = [];
  chunk.text.split("\n").forEach((text, index) => {
    for (const [label, pattern] of SIGNALS) {
      if (pattern.test(text)) {
        found.push({ label, line: chunk.startLine + index, text: text.trim().slice(0, 160) });
        break;
      }
    }
  });
  return found.slice(0, 12);
}
