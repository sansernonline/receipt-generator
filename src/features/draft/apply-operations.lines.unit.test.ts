import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply-operations";
import { coffee, croissant, draftWith } from "./test-kit";
import { parseDraft } from "./parse-draft";

const tea = { ...coffee, name: "ชา" };
const three = () => draftWith([coffee, croissant, tea]);
const names = (items: { name: string }[]) => items.map((i) => i.name);

describe("applyOperations: line numbers mean the draft the AI was shown", () => {
  it("[remove_item 1, update_item 2] edits the original line 2, not the original line 3", () => {
    const { draft } = applyOperations(three(), [{ op: "remove_item", line: 1 }, { op: "update_item", line: 2, set: { qty: 9 } }]);

    expect(draft.items.map((i) => [i.name, i.qty])).toEqual([["ครัวซองต์", 9], ["ชา", 3]]);
  });

  it("[update_item 1, remove_item 1] updates then removes the same line", () => {
    const { draft, isApplied } = applyOperations(three(), [{ op: "update_item", line: 1, set: { qty: 9 } }, { op: "remove_item", line: 1 }]);

    expect(isApplied).toBe(true);
    expect(names(draft.items)).toEqual(["ครัวซองต์", "ชา"]);
  });

  it("[remove_item 2, remove_item 1] removes the original lines 2 and 1", () => {
    const { draft } = applyOperations(three(), [{ op: "remove_item", line: 2 }, { op: "remove_item", line: 1 }]);

    expect(names(draft.items)).toEqual(["ชา"]);
  });

  it("an operation on a line the same batch already removed rejects the whole batch", () => {
    const before = three();

    const result = applyOperations(before, [{ op: "remove_item", line: 1 }, { op: "update_item", line: 1, set: { qty: 9 } }]);

    expect(result.isApplied).toBe(false);
    expect(result.draft).toBe(before);
  });

  it("an add_item in the batch does not move the numbers of the original lines", () => {
    const add = { op: "add_item", name: "น้ำ", qty: 1, unit: null, unit_price: 10, code: null, description: null };

    const { draft } = applyOperations(three(), [add, { op: "update_item", line: 3, set: { qty: 9 } }]);

    expect(draft.items.map((i) => i.qty)).toEqual([3, 2, 9, 1]);
  });
});

describe("applyOperations: size of the bill", () => {
  it("rejects a bill above 1e9 baht (qty x price) so satang stay exact", () => {
    const big = { op: "add_item", name: "ของใหญ่", qty: 1e6, unit: null, unit_price: 1e6, code: null, description: null };
    const before = draftWith();

    const result = applyOperations(before, [big]);

    expect(result.isApplied).toBe(false);
    expect(result.draft).toBe(before);
  });
});

describe("parseDraft: a damaged file never reaches calcTotals with a value it refuses", () => {
  const item = (over: object) => ({ name: "x", qty: 2, unitPrice: 10, ...over });
  const read = (over: object) => parseDraft({ items: [item(over)] }).items[0];

  it("reads a negative price as not set", () => expect(read({ unitPrice: -5 }).unitPrice).toBeNull());
  it("reads a percent above 100 as no discount", () => expect(read({ discount: { kind: "percent", value: 150 } }).discount).toBeNull());
  it("reads a line discount above the line as no discount", () => expect(read({ discount: { kind: "amount", value: 50 } }).discount).toBeNull());
  it("falls back to no VAT for a negative rate", () => expect(parseDraft({ items: [], footer: { vat: { mode: "exclusive", rate: -7 } } }).footer.vat.mode).toBe("none"));
});
