import fsp from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { POST as undoRoute } from "@/app/api/chats/[id]/undo/route";
import { okReply } from "@/features/ai/test-kit";
import { reply } from "../../../test/ai-stub/ai-stub";
import { useChatWithDraft } from "./chat-harness";
import { emptyDraft } from "./parse-draft";
import { draftWith } from "./test-kit";

const addLine = (n: number) => ({ op: "add_item", name: `รายการ ${n}`, qty: 1, unit: "ชิ้น", unit_price: 10, code: null, description: null });
const ops = (...operations: unknown[]) => okReply({ operations });
const names = (draft: { items: { name: string }[] }) => draft.items.map((i) => i.name);

describe("undo: a bill with 2 lines", () => {
  const { stub, send, undo, readDraftFile, dataDir, chatId } = useChatWithDraft(() => draftWith());

  test("[TC-ITEM-032] 3 edits then 3 undos give back the draft before the first edit, net 295.00", async () => {
    stub().script("text", ops({ op: "update_item", line: 1, set: { qty: 4 } }));
    await send("กาแฟเย็นเป็น 4 แก้ว");
    stub().script("text", ops(addLine(3)));
    const third = await send("เพิ่มน้ำเปล่า 1 ขวด 10");
    stub().script("text", ops({ op: "set_line_discount", line: 2, type: "percent", value: 10 }));
    await send("ลดครัวซองต์ 10%");

    await undo();
    await undo();
    const last = await undo();

    expect(third.draft.items).toHaveLength(3);
    expect(last.body.draft).toEqual(draftWith());
    expect(last.body.totals.net).toBe(295);
    expect(await readDraftFile()).toEqual(draftWith());
  });

  test("a batch that was refused is not a step: nothing to undo afterwards", async () => {
    stub().script("text", ops({ op: "update_item", line: 9, set: { qty: 4 } }));
    const refused = await send("แก้บรรทัด 9");

    const res = await undo();

    expect(refused.canUndo).toBe(false);
    expect(res.status).toBe(409);
  });

  test("an answer with no operations (a question) is not a step", async () => {
    stub().script("text", reply({ status: "clarify", reason: null, action: null, operations: [], question: "ลบบรรทัดไหน", reply: null }));
    await send("ลบ");

    expect((await undo()).status).toBe(409);
  });

  test("a damaged undo file means nothing to undo, not a failure", async () => {
    stub().script("text", ops(addLine(3)));
    await send("เพิ่ม");
    await fsp.writeFile(path.join(dataDir(), "chats", chatId(), "undo.json"), "{not json");

    expect((await undo()).status).toBe(409);
  });
});

describe("undo: from an empty draft", () => {
  const { stub, send, undo } = useChatWithDraft(emptyDraft);

  test("[TC-ITEM-033] 10 edits then 10 undos give an empty draft, net 0.00", async () => {
    for (let n = 1; n <= 10; n++) {
      stub().script("text", ops(addLine(n)));
      await send(`รายการ ${n}`);
    }

    let last = await undo();
    for (let n = 1; n < 10; n++) last = await undo();

    expect(last.body.draft.items).toEqual([]);
    expect(last.body.totals.net).toBe(0);
    expect(last.body.canUndo).toBe(false);
  });

  test("[TC-ITEM-034] after 11 edits 10 undos leave the first line and the 11th undo changes nothing", async () => {
    let answer;
    for (let n = 1; n <= 11; n++) {
      stub().script("text", ops(addLine(n)));
      answer = await send(`รายการ ${n}`);
    }

    let tenth = await undo();
    for (let n = 1; n < 10; n++) tenth = await undo();
    const eleventh = await undo();

    expect(answer?.canUndo).toBe(true);
    expect(names(tenth.body.draft)).toEqual(["รายการ 1"]);
    expect(tenth.body.canUndo).toBe(false);
    expect(eleventh.status).toBe(409);
  });
});

describe("undo route guards", () => {
  const { chatId } = useChatWithDraft(emptyDraft);
  const post = (id: string, origin: string) =>
    undoRoute(new Request(`http://localhost/api/chats/${id}/undo`, { method: "POST", headers: { host: "localhost:3000", origin } }), { params: Promise.resolve({ id }) });

  test("a request from another origin is refused", async () => {
    expect((await post(chatId(), "http://evil.example")).status).toBe(403);
  });

  test("an id that is not a chat id is refused", async () => {
    expect((await post("../x", "http://localhost:3000")).status).toBe(400);
  });
});
