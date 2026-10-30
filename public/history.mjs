#!/usr/bin/env node
// Prints what you dictated into your coding tools, from your local Wispr Flow history.
// Read-only: it works on a temporary copy, sends nothing anywhere, and deletes the copy.
// The Flow database is undocumented, so a Flow update can break this script.
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const CODING_APPS = /cursor|code|terminal|iterm|warp|ghostty|windsurf|zed|kiro|codex|antigravity/i;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function defaultPath() {
  if (platform() === "win32") return join(process.env.APPDATA ?? "", "Wispr Flow", "flow.sqlite");
  return join(homedir(), "Library", "Application Support", "Wispr Flow", "flow.sqlite");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const source = arg("db", defaultPath());
const days = Number(arg("days", "2"));
const appFilter = arg("app") ? new RegExp(arg("app"), "i") : CODING_APPS;
if (!existsSync(source)) fail(`No Flow history at ${source}. Pass its path with --db.`);

const folder = mkdtempSync(join(tmpdir(), "nijam-"));
const copy = join(folder, "flow.sqlite");
try {
  copyFileSync(source, copy);
  for (const suffix of ["-wal", "-shm"]) if (existsSync(source + suffix)) copyFileSync(source + suffix, copy + suffix);
  const db = new DatabaseSync(copy);
  const tables = db.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name);
  const hasColumn = (table, column) =>
    db.prepare(`pragma table_info("${table}")`).all().some((info) => info.name === column);
  const table = tables.find((name) => hasColumn(name, "formattedText"));
  if (!table) fail(`No dictation table found. Tables here: ${tables.join(", ")}`);

  const columns = db.prepare(`pragma table_info("${table}")`).all().map((info) => info.name);
  const appColumn = ["app", "appName", "application"].find((name) => columns.includes(name));
  const timeColumn = ["timestamp", "createdAt", "created_at"].find((name) => columns.includes(name));
  if (!timeColumn) fail(`No time column found. Columns here: ${columns.join(", ")}`);
  const text = columns.includes("editedText") ? `coalesce(nullif("editedText", ''), "formattedText")` : `"formattedText"`;

  const rows = db
    .prepare(`select ${text} as text, ${appColumn ? `"${appColumn}"` : "''"} as app, "${timeColumn}" as time from "${table}" order by "${timeColumn}"`)
    .all();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const toTime = (value) => (typeof value === "number" ? (value < 1e12 ? value * 1000 : value) : Date.parse(value));
  const kept = rows.filter((row) => row.text && toTime(row.time) >= since && (!appColumn || appFilter.test(row.app ?? "")));
  db.close();
  if (kept.length === 0) fail(`Nothing dictated into coding tools in the last ${days} days. Try --days or --app.`);
  console.log(kept.map((row) => row.text.trim()).join("\n"));
  console.error(`\n${kept.length} dictations. Paste them into Nijam under "What I told my tools".`);
} finally {
  rmSync(folder, { recursive: true, force: true });
}
