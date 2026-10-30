import { describe, expect, it } from "vitest";
import { absenceHolds, applyGate, checkTestCount, confirmCitation, hasLiveCode, locateSaid } from "./gate";
import type { Claim, Coverage, RawVerdict } from "./types";

const files = new Map([
  ["src/pay.ts", "line one\nexport async function charge(card: Card) {\n  return stripe.charges.create(card);\n}\n"],
  ["README.md", "Charges real cards through the payment provider.\n"],
  ["src/pay.test.ts", "it('charges a card', () => { expect(charge(card)).resolves.toBeTruthy(); });\n"],
]);
const complete: Coverage = { totalFiles: 3, readFiles: 3, bytes: 10, skipped: {}, complete: true };
const partial: Coverage = { ...complete, complete: false };
const claim: Claim = { id: "c1", said: "we charge real cards", claim: "Charges cards", kind: "feature", terms: [] };
const raw = (over: Partial<RawVerdict>): RawVerdict => ({
  verdict: "implemented",
  reason: "r",
  citations: [],
  sayInstead: "",
  ...over,
});

describe("confirmCitation", () => {
  it("accepts a quote that exists and returns the real lines", () => {
    const found = confirmCitation(files, {
      path: "src/pay.ts",
      startLine: 6,
      endLine: 6,
      quote: "return stripe.charges.create(card);",
    });
    expect(found?.startLine).toBe(3);
  });

  it("rejects an invented quote", () => {
    expect(
      confirmCitation(files, { path: "src/pay.ts", startLine: 3, endLine: 3, quote: "await refund(card, amount)" }),
    ).toBeNull();
  });

  it("rejects a file that does not exist", () => {
    expect(
      confirmCitation(files, { path: "src/nope.ts", startLine: 1, endLine: 1, quote: "return stripe.charges" }),
    ).toBeNull();
  });

  it("rejects a real quote far from the lines given", () => {
    const long = new Map([["a.ts", `${"x\n".repeat(100)}const realLine = 1;\n`]]);
    expect(confirmCitation(long, { path: "a.ts", startLine: 2, endLine: 2, quote: "const realLine = 1;" })).toBeNull();
  });

  it("matches across line breaks", () => {
    const found = confirmCitation(files, {
      path: "src/pay.ts",
      startLine: 2,
      endLine: 3,
      quote: "export async function charge(card: Card) {\n  return stripe.charges.create(card);",
    });
    expect(found).toMatchObject({ startLine: 2, endLine: 3 });
  });
});

describe("applyGate", () => {
  const ctx = { files, coverage: complete };
  const realCode = { path: "src/pay.ts", startLine: 3, endLine: 3, quote: "return stripe.charges.create(card);" };

  it("keeps implemented with real code evidence", () => {
    const result = applyGate(claim, raw({ citations: [realCode] }), ctx);
    expect(result.verdict).toBe("implemented");
    expect(result.overruled).toBeUndefined();
  });

  it("overrules implemented with no real citation", () => {
    const result = applyGate(
      claim,
      raw({ citations: [{ path: "src/pay.ts", startLine: 1, endLine: 1, quote: "invented evidence here" }] }),
      ctx,
    );
    expect(result.verdict).toBe("unclear");
    expect(result.overruled?.from).toBe("implemented");
  });

  it("does not accept the README as proof of working code", () => {
    const result = applyGate(
      claim,
      raw({
        citations: [{ path: "README.md", startLine: 1, endLine: 1, quote: "Charges real cards through the payment" }],
      }),
      ctx,
    );
    expect(result.verdict).toBe("unclear");
    expect(result.citations).toHaveLength(1);
  });

  it("does not accept a test as proof of working code", () => {
    const result = applyGate(
      claim,
      raw({ citations: [{ path: "src/pay.test.ts", startLine: 1, endLine: 1, quote: "it('charges a card'" }] }),
      ctx,
    );
    expect(result.verdict).toBe("unclear");
  });

  it("does not accept a comment or an import as proof", () => {
    const code = new Map([["src/a.ts", "// charges the card through stripe\nimport { Stripe } from 'stripe';\n"]]);
    const cite = (startLine: number, quote: string) => ({ path: "src/a.ts", startLine, endLine: startLine, quote });
    const check = (quote: string, line: number) =>
      applyGate(claim, raw({ citations: [cite(line, quote)] }), { files: code, coverage: complete }).verdict;
    expect(check("// charges the card through stripe", 1)).toBe("unclear");
    expect(check("import { Stripe } from 'stripe';", 2)).toBe("unclear");
  });

  it("refuses missing when a repo-wide search finds the words", () => {
    const related: Claim = { ...claim, terms: ["charges", "create", "stripe"] };
    const result = applyGate(related, raw({ verdict: "missing" }), ctx);
    expect(result.verdict).toBe("unclear");
    expect(result.overruled?.from).toBe("missing");
  });

  it("allows missing only when every file was read", () => {
    const absent: Claim = { ...claim, terms: ["whatsapp", "reminder"] };
    expect(applyGate(absent, raw({ verdict: "missing" }), ctx).verdict).toBe("missing");
    expect(applyGate(claim, raw({ verdict: "missing" }), { files, coverage: partial }).verdict).toBe("unclear");
  });

  it("requires source evidence for simulated", () => {
    expect(applyGate(claim, raw({ verdict: "simulated" }), ctx).verdict).toBe("unclear");
  });

  it("drops the rewrite for an implemented claim", () => {
    const result = applyGate(claim, raw({ citations: [realCode], sayInstead: "unused" }), ctx);
    expect(result.sayInstead).toBeUndefined();
  });
});

describe("hasLiveCode", () => {
  it("separates code from comments and imports", () => {
    expect(hasLiveCode("return charge(card);")).toBe(true);
    expect(hasLiveCode("// return charge(card);")).toBe(false);
    expect(hasLiveCode("# python comment")).toBe(false);
    expect(hasLiveCode("#[derive(Debug)]")).toBe(true);
    expect(hasLiveCode("from os import path")).toBe(false);
    expect(hasLiveCode("// note\nreturn 1;")).toBe(true);
  });
});

describe("absenceHolds", () => {
  it("needs terms to search for", () => {
    expect(absenceHolds({ ...claim, terms: [] }, files)).toBe(false);
  });
});

describe("locateSaid", () => {
  const pitch = "Hum   real cards charge karte hain, and it runs offline.";

  it("finds spoken words despite spacing and case", () => {
    expect(locateSaid(pitch, "real CARDS charge")).toBe("real cards charge");
  });

  it("finds Telugu and Devanagari text", () => {
    expect(locateSaid("ఇది నిజమైన కార్డులను ఛార్జ్ చేస్తుంది", "నిజమైన కార్డులను")).toBe("నిజమైన కార్డులను");
    expect(locateSaid("यह असली कार्ड चार्ज करता है", "असली कार्ड")).toBe("असली कार्ड");
  });

  it("rejects words nobody said", () => {
    expect(locateSaid(pitch, "processes one million payments")).toBeNull();
  });
});

describe("checkTestCount", () => {
  const facts = { sourceFiles: 1, sourceLines: 10, testFiles: 1, testCases: 12 };
  const metric: Claim = { ...claim, kind: "metric", said: "we have 477 tests", claim: "The repo has 477 tests" };

  it("flags an inflated count", () => {
    expect(checkTestCount(metric, facts)?.verdict).toBe("missing");
  });

  it("passes an honest count", () => {
    expect(checkTestCount({ ...metric, claim: "12 tests", said: "12 tests" }, facts)?.verdict).toBe("implemented");
  });

  it("ignores claims with no count", () => {
    expect(checkTestCount(claim, facts)).toBeNull();
  });
});
