import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply-operations";
import { addWater, coffee, croissant, draftWith } from "./test-kit";

describe("applyOperations (closed set, all or nothing)", () => {
  it("[TC-DOC-005] add_item appends to the end of the lines", () => {
    const { draft, isApplied } = applyOperations(draftWith(), [addWater]);

    expect(isApplied).toBe(true);
    expect(draft.items.map((i) => i.name)).toEqual(["กาแฟเย็น", "ครัวซองต์", "น้ำเปล่า"]);
  });

  it("does not change the draft it was given", () => {
    const before = draftWith();

    applyOperations(before, [addWater]);

    expect(before.items).toEqual([coffee, croissant]);
  });

  it("[TC-HDR-029] an operation outside the set rejects the whole batch, shop header words get the use-button text", () => {
    const before = draftWith();

    const result = applyOperations(before, [addWater, { op: "set_shop_name", name: "ร้านปลอม" }]);

    expect(result.isApplied).toBe(false);
    expect(result.draft).toBe(before);
    expect(result.notices).toEqual(['หัวบิลยืนยันแล้ว แก้ได้ที่ปุ่ม "แก้หัวบิล"']);
  });

  it("[TC-TOT-005] set_net_total is refused with the computed-total text and nothing is applied", () => {
    const result = applyOperations(draftWith(), [{ op: "set_net_total", value: 1 }, addWater]);

    expect(result.isApplied).toBe(false);
    expect(result.draft.items).toHaveLength(2);
    expect(result.notices[0]).toContain("คำนวณ");
  });

  it.each([["__proto__"], ["constructor"], ["toString"], ["hasOwnProperty"]])("treats the name %s as unknown, not as a handler", (name) => {
    expect(applyOperations(draftWith(), [{ op: name }]).isApplied).toBe(false);
  });

  it("[TC-TOT-004] money keys the AI adds to an operation never reach the draft", () => {
    const { draft } = applyOperations(draftWith(), [{ ...addWater, total: 999, amount: 999 }]);

    expect(JSON.stringify(draft)).not.toContain("999");
  });

  it("[TC-HDR-030] set_discount changes the footer only, the shop header has no place in the draft", () => {
    const { draft } = applyOperations(draftWith(), [{ op: "set_discount", type: "percent", value: 10 }]);

    expect(draft.footer.discount).toEqual({ kind: "percent", value: 10 });
    expect(Object.keys(draft).sort()).toEqual(["bill", "footer", "items"]);
  });

  it("[TC-ITEM-003] add_item with a null price adds the line with a blank price", () => {
    const { draft, isApplied } = applyOperations(draftWith([]), [{ ...addWater, unit_price: null }]);

    expect(isApplied).toBe(true);
    expect(draft.items[0].unitPrice).toBeNull();
  });

  it("update_item cannot blank a price", () => {
    const result = applyOperations(draftWith(), [{ op: "update_item", line: 1, set: { unit_price: null } }]);

    expect(result.isApplied).toBe(false);
  });

  it.each([{ qty: 0 }, { qty: null }, { unit_price: -5 }])("[TC-ITEM-002] add_item with %o is refused", (bad) => {
    const before = draftWith();

    const result = applyOperations(before, [{ ...addWater, ...bad }]);

    expect(result.isApplied).toBe(false);
    expect(result.draft).toBe(before);
  });

  const setBill = (fields: Record<string, unknown>) => applyOperations(draftWith(), [{ op: "set_bill_info", fields }]);
  const dateOp = (d: number, m: number, y: number) => setBill({ doc_date: { d, m, y, era: "BE" } });

  it("[TC-HDR-034] set_bill_info sets the customer and the bill number, other fields stay", () => {
    const { draft } = setBill({ customer_name: "คุณสมชาย ใจดี", doc_no: "RC-0042" });

    expect(draft.bill).toMatchObject({ customerName: "คุณสมชาย ใจดี", billNumber: "RC-0042", customerPhone: null });
  });

  it("[TC-HDR-056] phone and email are kept exactly as typed", () => {
    const { draft } = setBill({ customer_phone: "081-234-5678", customer_email: "somchai@example.com" });

    expect(draft.bill).toMatchObject({ customerPhone: "081-234-5678", customerEmail: "somchai@example.com" });
  });

  it("[TC-HDR-035] [TC-HDR-057] HTML in the name, email and phone is stored as raw text (the preview escaping waits for the bill preview row)", () => {
    const html = { customer_name: "<img src=x onerror=alert(1)>", customer_email: '"><img src=x onerror=alert(1)>@example.com', customer_phone: "<b>081</b>" };

    const { draft } = setBill(html);

    expect([draft.bill.customerName, draft.bill.customerEmail, draft.bill.customerPhone]).toEqual(Object.values(html));
  });

  it.each([[31, 2, 2569], [29, 2, 2568]])("[TC-HDR-036] %i/%i/%i does not exist, the batch is refused", (d, m, y) => {
    const result = dateOp(d, m, y);

    expect(result.isApplied).toBe(false);
    expect(result.draft.bill.billDate).toBeNull();
  });

  it("[TC-HDR-036] 29/2/2567 is a leap day (CE 2024) and is set", () => {
    expect(dateOp(29, 2, 2567).draft.bill.billDate).toEqual({ d: 29, m: 2, y: 2567, era: "BE" });
  });

  it("an unknown bill field refuses the batch, even next to a good one", () => {
    expect(setBill({ customer_name: "ก", shop_name: "ร้านปลอม" }).isApplied).toBe(false);
  });

  const badDay = { d: 31, m: 2, y: 2569, era: "BE" };

  it("[TC-HDR-036] a bad doc_date next to a good field refuses the whole batch", () => {
    const result = setBill({ customer_name: "คุณสมชาย", doc_date: badDay });

    expect(result.isApplied).toBe(false);
    expect(result.draft.bill.customerName).toBeNull();
  });

  it("[TC-HDR-036] a bad due_date is refused", () => {
    expect(setBill({ due_date: badDay }).isApplied).toBe(false);
  });

  it("[TC-HDR-036] a bad set_payment date is refused", () => {
    const result = applyOperations(draftWith(), [{ op: "set_payment", method: "cash", date: badDay }]);

    expect(result.isApplied).toBe(false);
  });
});
