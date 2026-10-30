import { describe, expect, it } from "vitest";
import { startClock, withinClock } from "./clock";

describe("defence clock", () => {
  it("accepts an answer in time", async () => {
    const { startedAt, token } = await startClock("c1", 1000);
    expect(await withinClock("c1", startedAt, token, 21_000)).toBe(true);
  });

  it("refuses a late answer", async () => {
    const { startedAt, token } = await startClock("c1", 1000);
    expect(await withinClock("c1", startedAt, token, 40_000)).toBe(false);
  });

  it("refuses a forged start time", async () => {
    const { token } = await startClock("c1", 1000);
    expect(await withinClock("c1", 39_000, token, 40_000)).toBe(false);
  });

  it("refuses a clock from another claim", async () => {
    const { startedAt, token } = await startClock("c2", 1000);
    expect(await withinClock("c1", startedAt, token, 2000)).toBe(false);
  });
});
