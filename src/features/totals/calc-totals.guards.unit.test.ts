import { describe, expect, it } from "vitest";
import { calcTotals } from "./calc-totals";

const bill = (unitPrice: number, rate = 7) => ({
  lines: [{ quantity: 1, unitPrice }],
  vat: { mode: "exclusive" as const, rate },
});

describe("calcTotals input guards", () => {
  it("rejects a price that is not a finite number", () => {
    expect(() => calcTotals(bill(Number.NaN))).toThrow(RangeError);
    expect(() => calcTotals(bill(Number.POSITIVE_INFINITY))).toThrow(RangeError);
  });

  it("rejects a VAT rate that is not a finite number", () => {
    expect(() => calcTotals(bill(100, Number.NaN))).toThrow(RangeError);
  });
});
