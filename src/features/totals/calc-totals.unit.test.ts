import { describe, expect, it } from "vitest";
import { calcTotals } from "./calc-totals";
import type { BillDraftLike, Discount, LineInput, VatSetting } from "./types";

const NO_VAT: VatSetting = { mode: "none", rate: 7 };
const exclusive = (rate = 7): VatSetting => ({ mode: "exclusive", rate });
const inclusive = (rate = 7): VatSetting => ({ mode: "inclusive", rate });

const coffee: LineInput = { quantity: 3, unitPrice: 55 };
const croissant: LineInput = { quantity: 2, unitPrice: 65 };
const bill = (lines: LineInput[], vat = NO_VAT, discount?: Discount): BillDraftLike => ({ lines, vat, discount });
const one = (unitPrice: number, vat: VatSetting, quantity = 1) => calcTotals(bill([{ quantity, unitPrice }], vat));
const percent = (value: number): Discount => ({ kind: "percent", value });
const amount = (value: number): Discount => ({ kind: "amount", value });

describe("calcTotals", () => {
  it("[TC-TOT-001] sums two lines to 295.00", () => {
    expect(calcTotals(bill([coffee])).subtotal).toBe(165);

    const t = calcTotals(bill([coffee, croissant]));
    expect([t.subtotal, t.net]).toEqual([295, 295]);
  });

  it("[TC-TOT-002] empty bill is 0.00 and a 20 baht bill discount gives 145.00", () => {
    const empty = calcTotals(bill([]));
    expect([empty.subtotal, empty.net]).toEqual([0, 0]);

    expect(calcTotals(bill([coffee], NO_VAT, amount(20))).net).toBe(145);
  });

  it("[TC-TOT-003] rounds half up on VAT: 1.50 and 0.50 exclusive, 1.50 inclusive", () => {
    expect(one(1.5, exclusive())).toMatchObject({ vat: 0.11, net: 1.61 });
    expect(one(0.5, exclusive())).toMatchObject({ vat: 0.04, net: 0.54 });
    expect(one(1.5, inclusive())).toMatchObject({ vat: 0.1, priceBeforeTax: 1.4, net: 1.5 });
  });

  it("[TC-TOT-006] exclusive 7% on 10,000.00", () => {
    expect(one(10000, exclusive())).toMatchObject({ vat: 700, net: 10700 });
  });

  it("[TC-TOT-007] exclusive 7% on 265.50", () => {
    const t = calcTotals(bill([coffee, croissant], exclusive(), percent(10)));
    expect(t).toMatchObject({ afterDiscount: 265.5, vat: 18.59, net: 284.09 });
  });

  it("[TC-TOT-008] inclusive 7% on 10,700.00", () => {
    expect(one(10700, inclusive())).toMatchObject({ priceBeforeTax: 10000, vat: 700, net: 10700 });
  });

  it("[TC-TOT-009] inclusive 7% on 265.50", () => {
    const t = calcTotals(bill([coffee, croissant], inclusive(), percent(10)));
    expect(t).toMatchObject({ priceBeforeTax: 248.13, vat: 17.37, net: 265.5 });
  });

  it("[TC-TOT-010] inclusive 7% with 5% line discount (FlowAccount)", () => {
    const line: LineInput = { quantity: 50, unitPrice: 250, discount: percent(5) };
    const t = calcTotals(bill([line], inclusive()));
    expect(t).toMatchObject({ afterDiscount: 11875, vat: 776.87, priceBeforeTax: 11098.13, net: 11875 });
    expect(t.lines[0].discount).toBe(625);
  });

  it("[TC-TOT-011] mode none charges no VAT", () => {
    expect(calcTotals(bill([coffee, croissant], NO_VAT))).toMatchObject({ vat: 0, net: 295 });
  });

  it("[TC-TOT-012] bill discount 10% comes before VAT, both modes", () => {
    const ex = calcTotals(bill([coffee, croissant], exclusive(), percent(10)));
    expect(ex).toMatchObject({ billDiscount: 29.5, afterDiscount: 265.5, vat: 18.59, net: 284.09 });

    const inc = calcTotals(bill([coffee, croissant], inclusive(), percent(10)));
    expect(inc).toMatchObject({ priceBeforeTax: 248.13, vat: 17.37, net: 265.5 });
  });

  it("[TC-TOT-013] rate 0% gives 0.00 VAT and a negative rate is rejected", () => {
    expect(one(1000, exclusive(0))).toMatchObject({ vat: 0, net: 1000 });
    expect(() => one(1000, exclusive(-7))).toThrow(RangeError);
  });

  it.todo("[TC-TOT-013] step 3: rate 7.5% accepted or not (SRS: รอยืนยัน)");

  it("[TC-TOT-014] VAT uses the one bill rate; a per-line vatRate is ignored", () => {
    const sneaky = { ...coffee, vatRate: 0 } as LineInput;
    const t = calcTotals(bill([sneaky, croissant], exclusive()));
    expect(t).toMatchObject({ vat: 20.65, net: 315.65 });
  });

  it("[TC-TOT-021] bill discount 10% gives 29.50 and net 265.50", () => {
    const t = calcTotals(bill([coffee, croissant], NO_VAT, percent(10)));
    expect([t.billDiscount, t.net]).toEqual([29.5, 265.5]);
  });

  it("[TC-TOT-022] bill discount 20 baht gives 20.00 and net 275.00", () => {
    const t = calcTotals(bill([coffee, croissant], NO_VAT, amount(20)));
    expect([t.billDiscount, t.net]).toEqual([20, 275]);
  });

  it("[TC-TOT-023] bill discount 0% and 100%", () => {
    const at = (value: number) => calcTotals(bill([coffee, croissant], NO_VAT, percent(value)));
    expect([at(0).billDiscount, at(0).net]).toEqual([0, 295]);
    expect([at(100).billDiscount, at(100).net]).toEqual([295, 0]);
  });

  it.todo("[TC-TOT-023] step 3: 150% discount -> -147.50 with warning (SRS: รอยืนยัน; warning belongs to UI row)");
  it.todo("[TC-TOT-024] unreadable discount leaves draft unchanged (AI stub integration, not pure logic)");

  it("[TC-TOT-049] exclusive 7% on 950.00 (SMEasy)", () => {
    expect(one(950, exclusive())).toMatchObject({ subtotal: 950, vat: 66.5, net: 1016.5 });
  });

  it("[TC-TOT-050] 107.50 x 7% = 7.525 rounds up to 7.53", () => {
    expect(one(107.5, exclusive())).toMatchObject({ vat: 7.53, net: 115.03 });
  });

  it("[TC-TOT-051] 3 x 333.33 exclusive 7% gives VAT 70.00 and net 1,069.99", () => {
    expect(one(333.33, exclusive(), 3)).toMatchObject({ subtotal: 999.99, vat: 70, net: 1069.99 });
  });

  it("[TC-TOT-052] inclusive 7% on 1,016.50 gives before-tax 950.00 and VAT 66.50", () => {
    expect(one(1016.5, inclusive())).toMatchObject({ priceBeforeTax: 950, vat: 66.5, net: 1016.5 });
  });
});

describe("line discount", () => {
  const croissantWith = (discount: Discount, unitPrice = 65, quantity = 2) =>
    calcTotals(bill([coffee, { quantity, unitPrice, discount }]));

  it("[TC-ITEM-020] 10% on croissant gives 13.00 and 117.00, total 282.00", () => {
    const t = croissantWith(percent(10));
    expect(t.lines[1]).toMatchObject({ discount: 13, amount: 117 });
    expect(t.subtotal).toBe(282);
  });

  it("[TC-ITEM-021] 20 baht on croissant gives 110.00, total 275.00", () => {
    const t = croissantWith(amount(20));
    expect(t.lines[1].amount).toBe(110);
    expect(t.subtotal).toBe(275);
  });

  it("[TC-ITEM-022] 100% and 130.00 give 0.00; 130.01 and 101% are rejected", () => {
    expect(croissantWith(percent(100)).lines[1].amount).toBe(0);
    expect(croissantWith(amount(130)).lines[1].amount).toBe(0);
    expect(() => croissantWith(amount(130.01))).toThrow(RangeError);
    expect(() => croissantWith(percent(101))).toThrow(RangeError);
  });

  it("[TC-ITEM-023] 10% of 10.05 is 1.005 and rounds up to 1.01, amount 9.04", () => {
    const t = calcTotals(bill([{ quantity: 1, unitPrice: 10.05, discount: percent(10) }]));
    expect(t.lines[0]).toMatchObject({ discount: 1.01, amount: 9.04 });
  });
});
