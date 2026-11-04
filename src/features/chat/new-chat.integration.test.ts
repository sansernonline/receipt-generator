import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, test } from "vitest";
import { GET, POST } from "@/app/api/chats/route";
import { createStore } from "@/features/storage/store";

let dataDir: string;
const post = (headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/chats", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", ...headers } }));
const readFileOf = (chatId: string, name: string) => fsp.readFile(path.join(dataDir, "chats", chatId, name), "utf8");

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-newchat-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

async function seedChatA() {
  const store = createStore(dataDir);
  const id = store.newId();
  const dir = store.chatDir(id);
  const messages = ["a", "b", "c", "d"].map((text) => ({ role: "user", text }));
  const draft = { items: [{ name: "กาแฟเย็น", qty: 3 }, { name: "ครัวซองต์", qty: 2 }], bill: { customerName: "คุณสมชาย ใจดี", billNumber: "RC-0042" } };
  await store.writeJsonAtomic(path.join(dir, "chat.json"), { id, title: "A", createdAt: "2026-10-18T01:00:00Z", updatedAt: "2026-10-18T01:00:00Z", shopId: null, billNumber: "RC-0042", customerName: "คุณสมชาย ใจดี", messages });
  await store.writeJsonAtomic(path.join(dir, "draft.json"), draft);
  await store.writeJsonAtomic(path.join(dir, "versions", "v1.json"), { n: 1 });
  return id;
}

async function snapshot(chatId: string) {
  const names = ["chat.json", "draft.json", "versions/v1.json"];
  return Promise.all(names.map((name) => readFileOf(chatId, name)));
}

describe("POST /api/chats", () => {
  test("[TC-CHAT-004] creating chat B leaves chat A files byte-for-byte unchanged", async () => {
    const a = await seedChatA();
    const before = await snapshot(a);

    const res = await post();

    expect(res.status).toBe(201);
    expect(await snapshot(a)).toEqual(before);
    expect((await createStore(dataDir).readIndex()).chats.map((c) => c.id)).toContain(a);
  });

  test("[TC-CHAT-033] chat B starts with no messages, no items and an empty bill", async () => {
    await seedChatA();

    const { chat } = await (await post()).json();

    expect(JSON.parse(await readFileOf(chat.id, "chat.json")).messages).toEqual([]);
    expect(JSON.parse(await readFileOf(chat.id, "draft.json"))).toEqual({ items: [], bill: { customerName: null, billNumber: null } });
    expect(await readFileOf(chat.id, "chat.json")).not.toContain("สมชาย");
  });

  test("new chat is titled แชตใหม่, has no shop, and is first in the index and the list", async () => {
    await seedChatA();

    const { chat } = await (await post()).json();
    const { chats } = await (await GET()).json();

    expect(chat).toMatchObject({ title: "แชตใหม่", shopId: null });
    expect(chats[0].id).toBe(chat.id);
    expect(chats).toHaveLength(2);
  });

  test.each([["http://evil.example"], ["null"], ["http://localhost:3000.evil.com"]])("rejects Origin %s with 403 (not 500) and creates nothing", async (origin) => {
    const res = await post({ origin });

    expect(res.status).toBe(403);
    expect((await createStore(dataDir).readIndex()).chats).toEqual([]);
  });

  // needs the AI connector (rows 17+) and the message send path; SRS defines no binding rule before that
  it.todo("[TC-CHAT-035] a slow AI reply for chat A never lands in chat B, and B's request carries nothing from A");
});
