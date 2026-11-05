import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { POST } from "@/app/api/chats/[id]/messages/route";
import { KEY, addWater, okReply, refuseReply, useAiStub } from "@/features/ai/test-kit";
import { createChat } from "@/features/chat/chats";
import { createStore } from "@/features/storage/store";
import { reply } from "../../../test/ai-stub/ai-stub";
import { coffee, croissant, draftWith } from "./test-kit";
import type { Draft, SendMessageResponse } from "./types";

const { state } = useAiStub();
const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };
const addTea = { ...addWater, name: "ชา", unit: "แก้ว", unit_price: 20 };
const ok = (operation: unknown) => okReply({ operations: [operation] });

let dataDir: string;
let chatId: string;
const chatPath = (...parts: string[]) => path.join(dataDir, "chats", chatId, ...parts);
const readDraftFile = async () => JSON.parse(await fsp.readFile(chatPath("draft.json"), "utf8")) as Draft;
const versionFiles = () => fsp.readdir(chatPath("versions"));

async function send(text: string): Promise<SendMessageResponse> {
  const request = new Request(`http://localhost/api/chats/${chatId}/messages`, { method: "POST", headers, body: JSON.stringify({ text }) });
  return (await POST(request, { params: Promise.resolve({ id: chatId }) })).json();
}

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-draft-"));
  Object.assign(process.env, { BILLGEN_DATA_DIR: dataDir, AI_BASE_URL: state.stub.baseUrl, AI_API_KEY: KEY });
  const store = createStore(dataDir);
  chatId = (await createChat(store)).id;
  await store.writeJsonAtomic(chatPath("draft.json"), draftWith());
  // stand-in for the version folder (the versions row defines the real one): v1 must stay as it is
  await store.writeJsonAtomic(chatPath("versions", "v1.json"), { net: 295 });
});

afterEach(async () => {
  for (const name of ["BILLGEN_DATA_DIR", "AI_BASE_URL", "AI_API_KEY"]) delete process.env[name];
  await fsp.rm(dataDir, { recursive: true, force: true });
});

describe("POST /api/chats/[id]/messages with the draft", () => {
  test("[TC-TOT-004] a total of 999 from the AI is never used: the net stays 295.00 in the answer and in draft.json", async () => {
    state.stub.script("text", reply({ status: "ok", reason: null, action: null, operations: [addWater], question: null, reply: "ok", total: 999 }));

    const first = await send("เพิ่มบันทึก");
    state.stub.script("text", ok({ op: "set_remarks", text: "บันทึก" }));
    const second = await send("เพิ่มบันทึก");

    expect(first.totals.net).toBe(295);
    expect(second.totals.net).toBe(295);
    expect(JSON.stringify(await readDraftFile())).not.toContain("999");
  });

  test("[TC-TOT-004] a normal add_item of 10 baht gives net 305.00 from calcTotals, with no 999 in the file", async () => {
    state.stub.script("text", ok({ ...addWater, unit_price: 10 }));

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 5");

    expect(res.totals.net).toBe(305);
    expect(JSON.stringify(await readDraftFile())).not.toContain("999");
  });

  // At the route the batch is stopped earlier, by validate-reply (read only here); the server layer that refuses
  // an operation outside the set with the computed-total text is proved in apply-operations.unit.test.ts
  test("[TC-TOT-005] a set_net_total batch is not applied: 2 lines, net 295.00, a Thai notice", async () => {
    state.stub.script("text", okReply({ operations: [{ op: "set_net_total", value: 1 }, addWater] }));

    const res = await send("ตั้งยอดสุทธิ 1 บาท");

    expect(res.draft.items).toHaveLength(2);
    expect(res.totals.net).toBe(295);
    expect(res.notices).toHaveLength(1);
    expect((await readDraftFile()).items).toHaveLength(2);
  });

  test("[TC-HDR-028] asking to rename the shop gives the use-the-button text and changes nothing in the draft", async () => {
    state.stub.script("text", refuseReply("use_button", { action: "edit_header" }));

    const res = await send("เปลี่ยนชื่อร้านเป็นร้านใหม่");

    expect(res.notices).toEqual(['หัวบิลยืนยันแล้ว แก้ได้ที่ปุ่ม "แก้หัวบิล"']);
    expect(await readDraftFile()).toEqual(draftWith());
  });

  // same as TC-TOT-005: validate-reply stops it first, the server-side refusal is proved in apply-operations.unit.test.ts
  test("[TC-HDR-029] a set_shop_name from the AI applies nothing, not even the valid add_item next to it", async () => {
    state.stub.script("text", okReply({ operations: [addWater, { op: "set_shop_name", name: "ร้านปลอม" }] }));

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.draft.items).toEqual([coffee, croissant]);
    expect(await readDraftFile()).toEqual(draftWith());
  });

  test("[TC-HDR-030] add_item and set_discount change the draft; the chat keeps its shop and the draft has no header", async () => {
    const shopBefore = JSON.parse(await fsp.readFile(chatPath("chat.json"), "utf8")).shopId;
    state.stub.script("text", ok(addWater), ok({ op: "set_discount", type: "percent", value: 10 }));

    await send("เพิ่มน้ำเปล่า 1 ขวด 10");
    await send("ลดท้ายบิล 10%");

    const draft = await readDraftFile();
    expect(draft.items).toHaveLength(3);
    expect(draft.footer.discount).toEqual({ kind: "percent", value: 10 });
    expect(Object.keys(draft).sort()).toEqual(["bill", "footer", "items"]);
    expect(JSON.parse(await fsp.readFile(chatPath("chat.json"), "utf8")).shopId).toBe(shopBefore);
  });

  test("[TC-DOC-004] 3 edits overwrite the one draft and leave the version folder with v1 untouched", async () => {
    state.stub.script("text", ok({ op: "update_item", line: 1, set: { qty: 4 } }), ok(addWater), ok({ op: "set_discount", type: "percent", value: 10 }));

    await send("กาแฟเย็นเป็น 4 แก้ว");
    await send("เพิ่มน้ำเปล่า 1 ขวด 10");
    const last = await send("ลดท้ายบิล 10%");

    expect(last.totals.net).toBe(324);
    expect((await readDraftFile()).items.map((i) => i.qty)).toEqual([4, 2, 1]);
    expect(await versionFiles()).toEqual(["v1.json"]);
    expect(JSON.parse(await fsp.readFile(chatPath("versions", "v1.json"), "utf8"))).toEqual({ net: 295 });
  });

  test("[TC-DOC-005] 2 messages sent at the same time both land: 4 lines, none lost or doubled, draft.json is valid JSON", async () => {
    state.stub.script("text", ok(addWater), ok(addTea));

    const [a, b] = await Promise.all([send("เพิ่มน้ำเปล่า 1 ขวด 10"), send("เพิ่มชา 1 แก้ว 20")]);

    expect([a.error, b.error]).toEqual([undefined, undefined]);
    expect((await readDraftFile()).items.map((i) => i.name).sort()).toEqual(["กาแฟเย็น", "ครัวซองต์", "ชา", "น้ำเปล่า"].sort());
  });

  test("2 messages sent together that use line numbers: only the first to be saved applies, no line is edited by mistake", async () => {
    const slow = (operation: unknown) => ({ ...ok(operation), delayMs: 200 });
    state.stub.script("text", slow({ op: "remove_item", line: 1 }), slow({ op: "update_item", line: 2, set: { qty: 9 } }));

    const results = await Promise.all([send("ลบบรรทัด 1"), send("ครัวซองต์เป็น 9")]);

    const final = (await readDraftFile()).items.map((i) => [i.name, i.qty]);
    expect(results.filter((r) => r.notices.includes("ร่างเปลี่ยนระหว่างรอ ลองสั่งอีกครั้ง"))).toHaveLength(1);
    expect([[["ครัวซองต์", 2]], [["กาแฟเย็น", 3], ["ครัวซองต์", 9]]]).toContainEqual(final);
  });

  test("[TC-DOC-006] AI answers 500: a Thai retry text, the draft stays at 2 lines, no new version", async () => {
    state.stub.script("text", { status: 500 });

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.error).toBe("ai_unreachable");
    expect(res.notices[0]).toContain("ลองใหม่");
    expect((await readDraftFile()).items).toHaveLength(2);
    expect(await versionFiles()).toEqual(["v1.json"]);
  });

  test("the user message is kept and the assistant reply is added when the AI answers", async () => {
    state.stub.script("text", ok(addWater));

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(JSON.parse(await fsp.readFile(chatPath("chat.json"), "utf8")).messages).toHaveLength(2);
  });

  test("without an AI key nothing is sent to the AI and the draft stays", async () => {
    delete process.env.AI_API_KEY;

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(state.stub.requests).toHaveLength(0);
    expect(res.notices).toHaveLength(1);
    expect(res.draft.items).toHaveLength(2);
  });
});
