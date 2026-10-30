import type { Coverage, RepoFacts } from "./types";

export type FileKind = "source" | "test" | "doc" | "config" | "fixture";

export interface Snapshot {
  files: Map<string, string>;
  coverage: Coverage;
}

const SOURCE_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|sol|move|cairo|vue|svelte|sh|sql|dart|ex|exs|scala|lua|zig)$/i;
const DOC_EXT = /\.(md|mdx|rst|txt|adoc)$/i;
const TEST_PATH =
  /(^|\/)(__tests__|tests?|spec|e2e|cypress|playwright)(\/|$)|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$|_test\.(go|py|rs)$/i;
const FIXTURE_PATH = /(^|\/)(fixtures?|mocks?|__mocks__|stubs?|samples?|examples?|demo|seed|seeds)(\/|$)/i;

export function classify(path: string): FileKind {
  if (TEST_PATH.test(path)) return "test";
  if (FIXTURE_PATH.test(path)) return "fixture";
  if (DOC_EXT.test(path)) return "doc";
  if (SOURCE_EXT.test(path)) return "source";
  return "config";
}

const SKIP_DIR =
  /(^|\/)(node_modules|vendor|dist|build|out|target|\.next|\.git|coverage|__pycache__|\.venv|venv|third_party)(\/|$)/;
const SKIP_FILE =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|go\.sum|bun\.lockb?)$|\.(min\.js|min\.css|map)$/;
const BINARY =
  /\.(png|jpe?g|gif|webp|avif|ico|svg|pdf|zip|gz|tar|wasm|woff2?|ttf|otf|eot|mp[34]|webm|mov|wav|bin|so|dylib|dll|exe|class|jar|pyc|lockb|sqlite|db)$/i;

export type SkipReason = "dependency or build output" | "lockfile or minified" | "binary" | "over file size cap";

export function skipReason(path: string, size: number, maxFileBytes: number): SkipReason | null {
  if (SKIP_DIR.test(path)) return "dependency or build output";
  if (SKIP_FILE.test(path)) return "lockfile or minified";
  if (BINARY.test(path)) return "binary";
  if (size > maxFileBytes) return "over file size cap";
  return null;
}

const RANK: Record<FileKind, number> = { source: 0, doc: 1, test: 2, config: 3, fixture: 4 };

/** Reading order under the byte cap: code first, so a cap drops the least useful files. */
export function byReadingOrder<T extends { path: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => RANK[classify(a.path)] - RANK[classify(b.path)] || a.path.localeCompare(b.path),
  );
}

export function countTestCases(path: string, text: string): number {
  if (classify(path) !== "test" && !/#\[test\]/.test(text)) return 0;
  const live = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|#(?!\[)).*$/gm, "");
  const js = (live.match(/(^|[^\w.])(it|test)(\.\w+(\([^)]*\))?)*\(\s*['"`]/gm) ?? []).filter(
    (call) => !/\.(skip|todo|fixme)\b/.test(call),
  ).length;
  const py = live.match(/^\s*(async\s+)?def\s+test_/gm)?.length ?? 0;
  const rust = live.match(/#\[(tokio::)?test\](?!\s*#\[ignore)/g)?.length ?? 0;
  const go = live.match(/^func\s+Test[A-Z]/gm)?.length ?? 0;
  return js + py + rust + go;
}

export function factsOf(files: Map<string, string>): RepoFacts {
  const facts: RepoFacts = { sourceFiles: 0, sourceLines: 0, testFiles: 0, testCases: 0 };
  for (const [path, text] of files) {
    const kind = classify(path);
    if (kind === "source") {
      facts.sourceFiles += 1;
      facts.sourceLines += text.split("\n").length;
    }
    if (kind === "test") facts.testFiles += 1;
    facts.testCases += countTestCases(path, text);
  }
  return facts;
}

export function snapshotFrom(entries: Record<string, string>): Snapshot {
  const files = new Map(Object.entries(entries));
  const bytes = [...files.values()].reduce((sum, text) => sum + text.length, 0);
  return {
    files,
    coverage: { totalFiles: files.size, readFiles: files.size, bytes, skipped: {}, complete: true },
  };
}
