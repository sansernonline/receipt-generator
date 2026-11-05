import { describe, expect, it } from "vitest";
import { issueBlockers } from "./issue-blockers";
import { netNotices } from "./net-notices";
import { draftWith } from "./test-kit";
import type { Draft } from "./types";

const withDiscount = (baht: number): Draft => {
  const draft = draftWith();
  return { ...draft, footer: { ...draft.footer, discount: { kind: "amount", value: baht } } };
};
const withLine = (over: object): Draft => {
  const draft = draftWith();
  return { ...draft, items: [...draft.items, { ...draft.items[0], name: "น้ำเปล่า", ...over }] };
};

describe("issueBlockers", () => {
  it("is empty for a complete draft with a positive net", () => {
    expect(issueBlockers(draftWith())).toEqual([]);
  });

  it("[TC-TOT-041] a net of -5.00 blocks issuing with a Thai reason that shows the amount", () => {
    expect(issueBlockers(withDiscount(300))).toEqual(["ยอดสุทธิติดลบ (-5.00 บาท) ลดส่วนลดก่อนจึงออกบิลได้"]);
  });

  it("[TC-TOT-043] a discount of 20 baht brings the net back to 275.00 and nothing blocks", () => {
    expect(issueBlockers(withDiscount(20))).toEqual([]);
  });

  it("[TC-TOT-046] line 3 without a price says 'บรรทัด 3 ยังไม่มีราคา'", () => {
    expect(issueBlockers(withLine({ qty: 1, unitPrice: null }))).toEqual(["บรรทัด 3 ยังไม่มีราคา ใส่ราคาก่อนออกบิล"]);
  });

  it("[TC-TOT-047] line 2 without a qty says 'บรรทัด 2 ยังไม่มีจำนวน'", () => {
    const draft = draftWith();
    draft.items[1] = { ...draft.items[1], qty: null };

    expect(issueBlockers(draft)).toEqual(["บรรทัด 2 ยังไม่มีจำนวน ใส่จำนวนก่อนออกบิล"]);
  });

  it("[TC-TOT-048] filling the missing price clears the reason", () => {
    expect(issueBlockers(withLine({ qty: 1, unitPrice: 10 }))).toEqual([]);
  });

  it("a line with neither price nor qty reports the price first, one reason per line", () => {
    expect(issueBlockers(withLine({ qty: null, unitPrice: null }))).toEqual(["บรรทัด 3 ยังไม่มีราคา ใส่ราคาก่อนออกบิล"]);
  });
});

describe("netNotices", () => {
  it("[TC-TOT-037] total 100.00 with a 150 baht discount gives -50.00 and a negative warning", () => {
    const before = draftWith([{ ...draftWith().items[0], qty: 1, unitPrice: 100 }]);
    const after = { ...before, footer: { ...before.footer, discount: { kind: "amount" as const, value: 150 } } };

    expect(netNotices(before, after)).toEqual(["ยอดสุทธิ 100.00 → -50.00 บาท", "ยอดติดลบ ออกบิลไม่ได้จนกว่าจะแก้ส่วนลด"]);
  });

  it("[TC-TOT-038] a net of 0.00 is not negative", () => {
    expect(netNotices(draftWith(), withDiscount(295))).toEqual(["ยอดสุทธิ 295.00 → 0.00 บาท"]);
  });

  it("[TC-TOT-038] a net of -0.01 is negative", () => {
    expect(netNotices(draftWith(), withDiscount(295.01))[1]).toMatch(/ยอดติดลบ/);
  });

  it("[TC-TOT-040] an unchanged net gives no notice", () => {
    expect(netNotices(draftWith(), withDiscount(0))).toEqual([]);
  });

  it("writes thousands with a comma", () => {
    const big = draftWith([{ ...draftWith().items[0], qty: 1, unitPrice: 1016.5 }]);

    expect(netNotices(draftWith(), big)[0]).toBe("ยอดสุทธิ 295.00 → 1,016.50 บาท");
  });
});
