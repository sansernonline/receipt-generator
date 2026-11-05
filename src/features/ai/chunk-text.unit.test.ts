import { describe, expect, it } from "vitest";
import { inputBudgetChars, splitForBudget } from "./chunk-text";

describe("splitForBudget", () => {
  it("keeps text that fits as one piece", () => {
    expect(splitForBudget("กาแฟ 55\nชา 40", 100)).toEqual(["กาแฟ 55\nชา 40"]);
  });

  it("splits on line breaks and never exceeds the budget", () => {
    const pieces = splitForBudget(["aaaa", "bbbb", "cccc"].join("\n"), 9);

    expect(pieces).toEqual(["aaaa\nbbbb", "cccc"]);
  });

  it("cuts a single line that is longer than the budget", () => {
    expect(splitForBudget("abcdefg", 3)).toEqual(["abc", "def", "g"]);
  });

  it("returns nothing for blank text", () => {
    expect(splitForBudget("  \n ", 10)).toEqual([]);
  });
});

describe("inputBudgetChars", () => {
  it("leaves room for the answer and the fixed prompt", () => {
    const budget = inputBudgetChars({ maxTokens: 8192 }, 3000);

    expect(budget).toBeGreaterThan(0);
    expect(budget).toBeLessThan(8192 * 2 - 3000);
  });

  it("is 0 when the fixed prompt alone is over the ceiling", () => {
    expect(inputBudgetChars({ maxTokens: 8192 }, 100_000)).toBe(0);
  });
});
