import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const folder = mkdtempSync(join(tmpdir(), "nijam-test-"));
const script = join(process.cwd(), "public/history.mjs");

function makeDb(name: string, sql: string): string {
  const path = join(folder, name);
  execFileSync("node", [
    "--no-warnings",
    "-e",
    `const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(${JSON.stringify(path)});d.exec(${JSON.stringify(sql)});d.close()`,
  ]);
  return path;
}

const now = Date.now();
const db = makeDb(
  "flow.sqlite",
  `create table History (formattedText text, editedText text, app text, timestamp integer);
   insert into History values ('Add a rate limit to the check route', '', 'Cursor', ${now});
   insert into History values ('Raw text', 'Add receipts, edited by me', 'iTerm2', ${now});
   insert into History values ('Dinner at eight', '', 'WhatsApp', ${now});
   insert into History values ('Old instruction', '', 'Cursor', ${now - 30 * 864e5});`,
);

const history = (...args: string[]) => spawnSync("node", ["--no-warnings", script, "--db", db, ...args], { encoding: "utf8" });

describe("history script", () => {
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("keeps recent coding dictations and prefers your edits", () => {
    const { stdout } = history();
    expect(stdout).toContain("Add a rate limit to the check route");
    expect(stdout).toContain("Add receipts, edited by me");
    expect(stdout).not.toContain("Raw text");
  });

  it("leaves out personal messages and old dictations", () => {
    const { stdout } = history();
    expect(stdout).not.toContain("Dinner");
    expect(stdout).not.toContain("Old instruction");
  });

  it("never touches the original file", () => {
    const before = statSync(db).mtimeMs;
    history();
    expect(statSync(db).mtimeMs).toBe(before);
  });

  it("explains an unknown database instead of guessing", () => {
    const other = makeDb("other.sqlite", "create table Notes (body text);");
    const result = spawnSync("node", ["--no-warnings", script, "--db", other], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Tables here: Notes");
  });
});
