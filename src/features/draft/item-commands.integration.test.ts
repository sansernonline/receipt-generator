import { describe, expect, test } from "vitest";
import { okReply } from "@/features/ai/test-kit";
import { reply } from "../../../test/ai-stub/ai-stub";
import { useChatWithDraft } from "./chat-harness";
import { hasIncompleteLine } from "./draft-totals";
import { emptyDraft } from "./parse-draft";
import { coffee, croissant, draftWith } from "./test-kit";

const item = (name: string, qty: number, unit: string | null, unit_price: number | null) =>
  ({ op: "add_item", name, qty, unit, unit_price, code: null, description: null });
const addCoffee = item("กาแฟเย็น", 3, "แก้ว", 55);
const addCroissant = item("ครัวซองต์", 2, "ชิ้น", 65);
const addWater = item("น้ำเปล่า", 1, "ขวด", 10);
const water = { ...coffee, name: "น้ำเปล่า", qty: 1, unit: "ขวด", unitPrice: 10 };
const ops = (...operations: unknown[]) => okReply({ operations });
const clarify = (question: string) => reply({ status: "clarify", reason: null, action: null, operations: [], question, reply: null });
const lines = (items: { name: string; qty: number | null }[]) => items.map((i) => [i.name, i.qty]);

describe("item commands: add (empty draft)", () => {
  const { stub, send } = useChatWithDraft(emptyDraft);

  test("[TC-ITEM-001] one item with qty, unit and price gives 1 line, amount 165.00", async () => {
    stub().script("text", ops(addCoffee));

    const res = await send("กาแฟเย็น 3 แก้ว 55 บาท");

    expect(res.draft.items).toMatchObject([{ name: "กาแฟเย็น", qty: 3, unit: "แก้ว", unitPrice: 55 }]);
    expect(res.totals.net).toBe(165);
  });

  test("[TC-ITEM-002] qty 0 adds no line, the draft stays and a Thai text says so", async () => {
    stub().script("text", ops({ ...addCoffee, qty: 0 }));

    const res = await send("กาแฟเย็น 0 แก้ว 55 บาท");

    expect(res.draft.items).toEqual([]);
    expect(res.notices).toHaveLength(1);
  });

  test("[TC-ITEM-002] a negative price adds no line", async () => {
    stub().script("text", ops({ ...addCoffee, qty: 1, unit_price: -5 }));

    const res = await send("กาแฟเย็น 1 แก้ว -5 บาท");

    expect(res.draft.items).toEqual([]);
  });

  test("[TC-ITEM-003] an item with no price enters the draft with a blank price and the bill cannot be issued", async () => {
    stub().script("text", ops(item("น้ำเปล่า", 1, "ขวด", null)));

    const res = await send("น้ำเปล่า 1 ขวด");

    expect(res.draft.items).toMatchObject([{ name: "น้ำเปล่า", qty: 1, unit: "ขวด", unitPrice: null }]);
    expect(hasIncompleteLine(res.draft)).toBe(true);
  });

  test("[TC-ITEM-004] two items from one comma-separated line give 2 lines, net 295.00", async () => {
    stub().script("text", ops(addCoffee, addCroissant));

    const res = await send("กาแฟเย็น 3 แก้ว 55, ครัวซองต์ 2 ชิ้น 65");

    expect(lines(res.draft.items)).toEqual([["กาแฟเย็น", 3], ["ครัวซองต์", 2]]);
    expect(res.totals.net).toBe(295);
  });

  test("[TC-ITEM-005] a 2-line message gives 2 lines, net 295.00, and both lines reach the AI", async () => {
    stub().script("text", ops(addCoffee, addCroissant));
    const text = "กาแฟเย็น 3 แก้ว 55\nครัวซองต์ 2 ชิ้น 65";

    const res = await send(text);

    expect(res.draft.items).toHaveLength(2);
    expect(res.totals.net).toBe(295);
    expect(JSON.stringify(stub().requests[0].body)).toContain(JSON.stringify(text).slice(1, -1));
  });

  test("a price of 1200 (typed with a thousands comma) stays whole: net 2,600.00 (the AI reading is TC-ITEM-006, evaluation)", async () => {
    stub().script("text", ops(item("โต๊ะ", 1, "ชุด", 1200), item("เก้าอี้", 4, "ตัว", 350)));

    const res = await send("โต๊ะ 1 ชุด 1,200, เก้าอี้ 4 ตัว 350");

    expect(res.totals.net).toBe(2600);
  });

  test("[TC-ITEM-014] adding to an empty draft makes the first line, net 10.00", async () => {
    stub().script("text", ops(addWater));

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.draft.items).toHaveLength(1);
    expect(res.totals.net).toBe(10);
  });
});

describe("item commands: add, edit and remove on a draft with 2 lines", () => {
  const { stub, send, readDraftFile } = useChatWithDraft(() => draftWith());

  test("[TC-ITEM-013] adding water gives 3 lines, the new one last, net 305.00", async () => {
    stub().script("text", ops(addWater));

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.draft.items).toEqual([coffee, croissant, water]);
    expect(res.totals.net).toBe(305);
  });

  test("[TC-ITEM-015] coffee to 4 glasses: qty 4, amount 220.00, croissant unchanged, net 350.00", async () => {
    stub().script("text", ops({ op: "update_item", line: 1, set: { qty: 4 } }));

    const res = await send("กาแฟเย็นเป็น 4 แก้ว");

    expect(res.draft.items).toEqual([{ ...coffee, qty: 4 }, croissant]);
    expect(res.totals.net).toBe(350);
  });

  test("[TC-ITEM-016] price, unit and name of the named line change, one message each", async () => {
    stub().script("text",
      ops({ op: "update_item", line: 2, set: { unit_price: 70 } }),
      ops({ op: "update_item", line: 1, set: { unit: "ถ้วย" } }),
      ops({ op: "update_item", line: 2, set: { name: "ครัวซองต์เนยสด" } }));

    const first = await send("ครัวซองต์ราคา 70");
    const second = await send("เปลี่ยนหน่วยกาแฟเย็นเป็นถ้วย");
    await send("เปลี่ยนชื่อครัวซองต์เป็นครัวซองต์เนยสด");

    expect(first.totals.net).toBe(305);
    expect(second.totals.net).toBe(305);
    expect(await readDraftFile()).toMatchObject({ items: [{ unit: "ถ้วย" }, { name: "ครัวซองต์เนยสด", unitPrice: 70 }] });
  });

  test("[TC-ITEM-017] when the AI answers that line 9 is not found: draft unchanged, net 295.00, the Thai answer is shown", async () => {
    stub().script("text", clarify("ไม่พบบรรทัดที่ 9 ในบิล"));

    const res = await send("แก้บรรทัด 9 เป็น 5 ชิ้น");

    expect(res.draft).toEqual(draftWith());
    expect(res.totals.net).toBe(295);
    expect(res.messages.at(-1)?.text).toContain("ไม่พบบรรทัด");
  });

  test("[TC-ITEM-017] an update_item on a line that is not in the draft is refused: draft unchanged, a Thai notice", async () => {
    stub().script("text", ops({ op: "update_item", line: 9, set: { qty: 5 } }));

    const res = await send("แก้บรรทัด 9 เป็น 5 ชิ้น");

    expect(res.draft).toEqual(draftWith());
    expect(res.totals.net).toBe(295);
    expect(res.notices).toHaveLength(1);
  });

  test("[TC-ITEM-019] when the AI answers that the item is not in the draft: draft unchanged, net 295.00", async () => {
    stub().script("text", clarify("ไม่พบชาเขียวในบิล"));

    const res = await send("ลบชาเขียว");

    expect(res.draft).toEqual(draftWith());
    expect(res.totals.net).toBe(295);
    expect(res.messages.at(-1)?.text).toContain("ไม่พบ");
  });

  test("[TC-ITEM-019] a remove_item on a line that is not in the draft is refused: draft unchanged", async () => {
    stub().script("text", ops({ op: "remove_item", line: 3 }));

    const res = await send("ลบชาเขียว");

    expect(res.draft).toEqual(draftWith());
    expect(res.notices).toHaveLength(1);
  });
});

describe("item commands: remove", () => {
  const { stub, send } = useChatWithDraft(() => draftWith([coffee, croissant, { ...coffee, name: "น้ำเปล่า" }]));

  test("[TC-ITEM-018] removing water leaves coffee and croissant, net 295.00", async () => {
    stub().script("text", ops({ op: "remove_item", line: 3 }));

    const res = await send("ลบน้ำเปล่า");

    expect(res.draft.items.map((i) => i.name)).toEqual(["กาแฟเย็น", "ครัวซองต์"]);
    expect(res.totals.net).toBe(295);
  });
});
