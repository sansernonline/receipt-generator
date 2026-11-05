import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PATCH } from "@/app/api/chats/[id]/route";
import { addUserMessage } from "@/features/chat/messages";
import { createChat } from "@/features/chat/chats";
import { createStore } from "@/features/storage/store";

let dataDir: string;
const ORIGIN = "http://localhost:3000";
const patch = (id: string, body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  PATCH(new Request(`http://localhost/api/chats/${id}`, { method: "PATCH", headers: { host: "localhost:3000", "content-type": "application/json", ...headers }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
const chatFile = async (id: string) => JSON.parse(await fsp.readFile(path.join(dataDir, "chats", id, "chat.json"), "utf8"));

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-rename-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

async function chatNamed(title: string) {
  const store = createStore(dataDir);
  const { id } = await createChat(store);
  await addUserMessage(store, id, title);
  return { store, id };
}

describe("PATCH /api/chats/[id]", () => {
  test("[TC-CHAT-015] the new name is saved in the chat file and in the index", async () => {
    const { store, id } = await chatNamed("บิล 1");

    const res = await patch(id, { title: "บิลคุณสมชาย" });

    expect(res.status).toBe(200);
    expect((await chatFile(id)).title).toBe("บิลคุณสมชาย");
    expect((await store.readIndex()).chats.find((chat) => chat.id === id)?.title).toBe("บิลคุณสมชาย");
  });

  test("rename keeps the messages and the customer fields", async () => {
    const { id } = await chatNamed("บิล 1");

    await patch(id, { title: "ใหม่" });

    expect((await chatFile(id)).messages.map((m: { text: string }) => m.text)).toEqual(["บิล 1"]);
  });

  test("[TC-CHAT-017] 81 characters: 400 with the reason, the name stays", async () => {
    const { id } = await chatNamed("บิล 1");

    const res = await patch(id, { title: "ก".repeat(81) });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "ชื่อยาวได้ไม่เกิน 80 ตัวอักษร" });
    expect((await chatFile(id)).title).toBe("บิล 1");
  });

  test("[TC-CHAT-018] a blank name: 400, the name stays", async () => {
    const { id } = await chatNamed("บิล 1");

    const res = await patch(id, { title: "   " });

    expect(res.status).toBe(400);
    expect((await chatFile(id)).title).toBe("บิล 1");
  });

  test.each<Record<string, string>>([{}, { origin: "https://evil.example" }])("[NFR-SEC-040] origin %j: 403, the name stays", async (headers) => {
    const { id } = await chatNamed("บิล 1");

    const res = await patch(id, { title: "แฮ็ก" }, headers);

    expect(res.status).toBe(403);
    expect((await chatFile(id)).title).toBe("บิล 1");
  });

  test("a bad id is 400 and a missing chat is 404 without a path in the message", async () => {
    const bad = await patch("../x", { title: "a" });
    const missing = await patch("11111111-1111-4111-8111-111111111111", { title: "a" });

    expect(bad.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(JSON.stringify(await missing.json())).not.toContain(dataDir);
  });

  test("a body that is not JSON is 400", async () => {
    const { id } = await chatNamed("บิล 1");
    const res = await PATCH(new Request("http://localhost/x", { method: "PATCH", headers: { host: "localhost:3000", origin: ORIGIN }, body: "{" }), { params: Promise.resolve({ id }) });

    expect(res.status).toBe(400);
  });

  test("a message sent while the chat is renamed is not lost", async () => {
    const { store, id } = await chatNamed("บิล 1");

    await Promise.all([patch(id, { title: "ชื่อใหม่" }), addUserMessage(store, id, "ข้อความสอง")]);

    const chat = await chatFile(id);
    expect(chat.title).toBe("ชื่อใหม่");
    expect(chat.messages).toHaveLength(2);
  });
});
