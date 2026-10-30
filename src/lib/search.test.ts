import { describe, expect, it } from "vitest";
import { chunkFile, RepoIndex, signalsIn, tokenize } from "./search";
import { classify, countTestCases, skipReason } from "./snapshot";
import { parseRepoUrl, RepoError } from "./github";

describe("tokenize", () => {
  it("splits identifiers and keeps other scripts", () => {
    expect(tokenize("fetchUserData nijam నిజం")).toEqual(["fetch", "user", "data", "nijam", "నిజం"]);
  });
});

describe("chunkFile", () => {
  it("covers the last line and keeps line numbers", () => {
    const text = Array.from({ length: 130 }, (_, i) => `line ${i + 1}`).join("\n");
    const chunks = chunkFile("a.ts", text);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks.at(-1)?.endLine).toBe(130);
    expect(chunks[1]?.text.split("\n")[0]).toBe(`line ${chunks[1]?.startLine}`);
  });
});

describe("RepoIndex", () => {
  it("ranks code above a README that repeats the word", () => {
    const index = new RepoIndex(
      new Map([
        ["README.md", "payment payment payment gateway"],
        ["src/payment.ts", "export function capturePayment() { return gateway.capture(); }"],
      ]),
    );
    expect(index.search("payment gateway", 2)[0]?.path).toBe("src/payment.ts");
  });
});

describe("signalsIn", () => {
  it("flags fakes in source only", () => {
    const line = "const results = mockResults; // hard-coded";
    expect(signalsIn({ path: "a.ts", kind: "source", startLine: 7, endLine: 7, text: line })[0]?.line).toBe(7);
    expect(signalsIn({ path: "a.test.ts", kind: "test", startLine: 1, endLine: 1, text: line })).toEqual([]);
  });
});

describe("classify and skip", () => {
  it("separates code from tests, docs and fixtures", () => {
    expect(classify("src/app.ts")).toBe("source");
    expect(classify("src/app.test.ts")).toBe("test");
    expect(classify("tests/helpers.py")).toBe("test");
    expect(classify("docs/intro.md")).toBe("doc");
    expect(classify("src/mocks/users.ts")).toBe("fixture");
    expect(classify("package.json")).toBe("config");
  });

  it("skips what cannot be evidence", () => {
    expect(skipReason("node_modules/x/index.js", 10, 100)).toBe("dependency or build output");
    expect(skipReason("package-lock.json", 10, 100)).toBe("lockfile or minified");
    expect(skipReason("logo.png", 10, 100)).toBe("binary");
    expect(skipReason("src/big.ts", 200, 100)).toBe("over file size cap");
    expect(skipReason("src/a.ts", 10, 100)).toBeNull();
  });
});

describe("countTestCases", () => {
  it("counts JS, Python, Rust and Go tests", () => {
    expect(countTestCases("a.test.ts", "it('a', f);\ntest.each([1])('b', f);\ndescribe('c', f);")).toBe(2);
    expect(countTestCases("tests/test_a.py", "def test_a():\n  pass\nasync def test_b():\n  pass")).toBe(2);
    expect(countTestCases("src/lib.rs", "#[test]\nfn a() {}\n#[tokio::test]\nasync fn b() {}")).toBe(2);
    expect(countTestCases("x_test.go", "func TestA(t *testing.T) {}")).toBe(1);
  });

  it("leaves out skipped and commented-out tests", () => {
    const text = "it('real', f);\nit.skip('off', f);\ntest.todo('later');\n// it('old', f);\n/* it('older', f); */";
    expect(countTestCases("a.test.ts", text)).toBe(1);
  });
});

describe("parseRepoUrl", () => {
  it("accepts GitHub links only", () => {
    expect(parseRepoUrl("https://github.com/a/b.git")).toEqual({ owner: "a", name: "b" });
    expect(parseRepoUrl("github.com/a/b/")).toEqual({ owner: "a", name: "b" });
    expect(() => parseRepoUrl("https://evil.com/a/b")).toThrow(RepoError);
    expect(() => parseRepoUrl("https://github.com/a/b/../../c")).toThrow(RepoError);
  });
});
