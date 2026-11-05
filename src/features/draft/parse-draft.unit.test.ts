import { describe, expect, it } from "vitest";
import { emptyDraft, parseDraft } from "./parse-draft";

describe("parseDraft", () => {
  it("reads the first draft shape (items + customer name + bill number) and fills the new fields", () => {
    const old = { items: [{ name: "กาแฟเย็น", qty: 3 }], bill: { customerName: "คุณสมชาย", billNumber: "RC-0042" } };

    const draft = parseDraft(old);

    expect(draft.items).toEqual([{ code: null, name: "กาแฟเย็น", description: null, qty: 3, unit: null, unitPrice: null, discount: null }]);
    expect(draft.bill).toMatchObject({ customerName: "คุณสมชาย", billNumber: "RC-0042", customerPhone: null });
    expect(draft.footer).toEqual(emptyDraft().footer);
  });

  it.each([[null], [undefined], ["x"], [5], [[]], [{ items: "no" }]])("falls back to an empty draft for %j", (raw) => {
    expect(parseDraft(raw)).toEqual(emptyDraft());
  });

  it("drops the stored totals so they can never be read back as input", () => {
    expect(parseDraft({ items: [], totals: { net: 999 } })).toEqual(emptyDraft());
  });

  it("does not read inherited keys such as __proto__", () => {
    const raw = JSON.parse('{"items":[],"bill":{"__proto__":{"customerName":"x"}},"footer":{"remarks":"ok"}}');

    expect(parseDraft(raw).bill.customerName).toBeNull();
    expect(parseDraft(raw).footer.remarks).toBe("ok");
  });
});
