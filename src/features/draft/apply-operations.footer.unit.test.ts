import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyOperations } from "./apply-operations";
import { addWater, draftWith } from "./test-kit";

const setPayment = (method: unknown, date: unknown = null) => ({ op: "set_payment", method, date });
const setRemarks = (text: unknown) => ({ op: "set_remarks", text });
const apply = (...ops: unknown[]) => applyOperations(draftWith(), ops);
const cashDraft = () => {
  const draft = draftWith();
  return { ...draft, footer: { ...draft.footer, paymentMethod: "cash" as const } };
};

describe("payment method (FR-TOT-080)", () => {
  it.each([["cash"], ["transfer"], ["cheque"]])("[TC-TOT-031] %s is set", (method) => {
    expect(apply(setPayment(method)).draft.footer.paymentMethod).toBe(method);
  });

  it.each([["credit_card"], ["CASH"], [""], [7], [undefined]])("[TC-TOT-032] %o is refused, the method stays and the notice names the 3 kinds", (method) => {
    const before = cashDraft();

    const result = applyOperations(before, [setPayment(method)]);

    expect(result.draft).toBe(before);
    expect(result.notices[0]).toContain("เงินสด โอน หรือเช็ค");
  });

  it("[TC-TOT-032] a bad method next to a good operation refuses the whole batch", () => {
    const result = apply(addWater, setPayment("credit_card"));

    expect(result.isApplied).toBe(false);
    expect(result.draft.items).toHaveLength(2);
  });
});

describe("remarks (FR-TOT-090)", () => {
  it("[TC-TOT-034] 500 visible characters are saved, 501 are refused with the limit in the notice", () => {
    const saved = apply(setRemarks("ก".repeat(500))).draft;

    const result = applyOperations(saved, [setRemarks("ก".repeat(501))]);

    expect(saved.footer.remarks).toBe("ก".repeat(500));
    expect(result.draft.footer.remarks).toBe("ก".repeat(500));
    expect(result.notices[0]).toContain("500 ตัวอักษร");
  });

  it("[TC-TOT-034] stacked Thai vowels count as one visible character: 500 of them (1000 code units) are saved", () => {
    expect(apply(setRemarks("กิ".repeat(500))).isApplied).toBe(true);
  });

  it("[TC-TOT-034] 501 visible characters of stacked vowels are refused", () => {
    expect(apply(setRemarks("กิ".repeat(501))).isApplied).toBe(false);
  });

  it("[TC-TOT-035] HTML is stored as typed", () => {
    const html = "<img src=x onerror=alert(1)>";

    expect(apply(setRemarks(html)).draft.footer.remarks).toBe(html);
  });
});

describe("payment date (FR-TOT-130)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T05:00:00Z")); // 18 Oct 2569 12:00 Bangkok
  });
  afterEach(() => vi.useRealTimers());

  it("[TC-TOT-044] no year takes the current Buddhist year in Bangkok", () => {
    const { draft } = apply(setPayment("cash", { d: 20, m: 10, y: null, era: null }));

    expect(draft.footer.paymentDate).toEqual({ d: 20, m: 10, y: 2569, era: "BE" });
  });

  it("[TC-TOT-044] just after midnight in Bangkok is already the next year", () => {
    vi.setSystemTime(new Date("2026-12-31T17:30:00Z")); // 1 Jan 2570 00:30 Bangkok

    expect(apply(setPayment("cash", { d: 5, m: 1, y: null, era: null })).draft.footer.paymentDate?.y).toBe(2570);
  });

  it("[TC-TOT-044] a given year is kept", () => {
    const { draft } = apply(setPayment("cash", { d: 20, m: 10, y: 2568, era: "BE" }));

    expect(draft.footer.paymentDate).toEqual({ d: 20, m: 10, y: 2568, era: "BE" });
  });

  it.each([[31, 11, "31 Nov"], [29, 2, "29 Feb 2569 (not a leap year)"]])("[TC-TOT-045] %i/%i with no year is refused: %s", (d, m) => {
    const result = apply(setPayment("cash", { d, m, y: null, era: null }));

    expect(result.isApplied).toBe(false);
    expect(result.draft.footer.paymentDate).toBeNull();
  });

  it("[TC-TOT-045] a bad date next to a good method refuses the whole batch", () => {
    expect(apply(setPayment("cash", { d: 31, m: 11, y: null, era: null })).draft.footer.paymentMethod).toBeNull();
  });
});
