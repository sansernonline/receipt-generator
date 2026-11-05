import { describe, expect, test } from "vitest";
import { GET } from "@/app/api/chats/[id]/draft/route";
import { okReply } from "@/features/ai/test-kit";
import { useChatWithDraft } from "./chat-harness";
import { emptyDraft } from "./parse-draft";
import { coffee, draftWith } from "./test-kit";

const lineItems = (count: number) => Array.from({ length: count }, (_, i) => ({ ...coffee, name: `รายการ ${i + 1}` }));
const addLines = (count: number) =>
  lineItems(count).map(({ name }) => ({ op: "add_item", name, qty: 1, unit: "ชิ้น", unit_price: 10, code: null, description: null }));
const ops = (...operations: unknown[]) => okReply({ operations });
const tooMany = (over: number) => `บิลมีได้ไม่เกิน 200 รายการ (เกินมา ${over} รายการ)`;
const addWater = addLines(1)[0];

describe("item limit: draft already full", () => {
  const { stub, send, readDraftFile } = useChatWithDraft(() => draftWith(lineItems(200)));

  test("[TC-ITEM-026] 200 lines then 1 more adds nothing and says it is 1 over", async () => {
    stub().script("text", ops(addWater));

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.notices).toEqual([expect.stringContaining(tooMany(1))]);
    expect(res.draft.items).toHaveLength(200);
    expect((await readDraftFile()).items).toHaveLength(200);
  });
});

describe("item limit: one under", () => {
  const { stub, send } = useChatWithDraft(() => draftWith(lineItems(199)));

  test("[TC-ITEM-028] 199 lines plus 1 gives 200 and no refusal", async () => {
    stub().script("text", ops(addWater));

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.draft.items).toHaveLength(200);
    expect(res.notices.filter((n) => n.includes("ไม่เกิน 200"))).toEqual([]);
  });
});

describe("item limit: empty draft", () => {
  const { stub, send } = useChatWithDraft(emptyDraft);

  test("[TC-ITEM-027] 50 lines in one command are all added", async () => {
    stub().script("text", ops(...addLines(50)));

    const res = await send("รายการ 50 บรรทัด");

    expect(res.draft.items).toHaveLength(50);
    expect(res.notices.filter((n) => n.includes("ไม่เกิน 200"))).toEqual([]);
  });

  test("[TC-ITEM-029] 201 lines sent straight to the server are refused and the stored draft stays empty", async () => {
    stub().script("text", ops(...addLines(201)));

    const res = await send("ส่งตรง 201 บรรทัด");

    expect(res.notices).toEqual([expect.stringContaining(tooMany(1))]);
    expect(res.draft.items).toEqual([]);
  });

  test("[TC-ITEM-038] a picture list of 205 lines adds nothing and says 5 over", async () => {
    stub().script("text", ops(...addLines(205)));

    const res = await send("รูปรายการ 205 บรรทัด");

    expect(res.notices).toEqual([expect.stringContaining(tooMany(5))]);
    expect(res.draft.items).toEqual([]);
  });

  test("[TC-ITEM-040] 201 lines say 1 over, 200 lines are all taken", async () => {
    stub().script("text", ops(...addLines(201)));
    const refused = await send("201 บรรทัด");
    stub().script("text", ops(...addLines(200)));

    const accepted = await send("200 บรรทัด");

    expect(refused.notices).toEqual([expect.stringContaining(tooMany(1))]);
    expect(accepted.draft.items).toHaveLength(200);
    expect(accepted.notices.filter((n) => n.includes("ไม่เกิน 200"))).toEqual([]);
  });
});

describe("item limit: 198 lines and 5 more", () => {
  const { stub, send } = useChatWithDraft(() => draftWith(lineItems(198)));

  test("[TC-ITEM-039] none of the 5 are added, not even the first 2, and it says 3 over", async () => {
    stub().script("text", ops(...addLines(5)));

    const res = await send("รูปรายการ 5 บรรทัด");

    expect(res.notices).toEqual([expect.stringContaining(tooMany(3))]);
    expect(res.draft.items).toHaveLength(198);
  });
});

describe("item limit: a damaged file with 201 lines", () => {
  const { chatId } = useChatWithDraft(() => draftWith(lineItems(201)));

  test("[TC-ITEM-029] reading the draft does not fail and keeps 200 lines", async () => {
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: chatId() }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.draft.items).toHaveLength(200);
  });
});
