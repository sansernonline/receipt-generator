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
});
