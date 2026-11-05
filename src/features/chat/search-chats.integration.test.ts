import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GET } from "@/app/api/chats/route";
import { createStore } from "@/features/storage/store";
import { searchChats } from "./search-chats";

let dataDir: string;

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-search-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

async function seedChat(title: string, customerName: string | null, billNumber: string | null) {
  const store = createStore(dataDir);
  const id = store.newId();
  const chat = { id, title, createdAt: "2026-10-18T01:00:00Z", updatedAt: "2026-10-18T01:00:00Z", shopId: null, billNumber, customerName, messages: [] };
  await store.writeJsonAtomic(path.join(store.chatDir(id), "chat.json"), chat);
  await store.upsertIndex(chat);
  return id;
}

// what the screen sees: the list the server sends, searched as the user types
async function listedTitles(query: string) {
  const { chats } = await (await GET()).json();
  return searchChats(chats, query).map((chat: { title: string }) => chat.title);
}

describe("search over the list the server sends", () => {
  test("[TC-CHAT-023] the customer name สมชาย finds only the chat of that customer", async () => {
    await seedChat("แชตแรก", "สมชาย ใจดี", null);
    await seedChat("แชตสอง", "สมหญิง รักดี", null);
    await seedChat("แชตสาม", null, null);

    expect(await listedTitles("สมชาย")).toEqual(["แชตแรก"]);
  });

  test("[TC-CHAT-024] the bill number RC-2569-0042 finds that chat and not RC-2569-0043", async () => {
    await seedChat("บิลหนึ่ง", null, "RC-2569-0042");
    await seedChat("บิลสอง", null, "RC-2569-0043");

    expect(await listedTitles("RC-2569-0042")).toEqual(["บิลหนึ่ง"]);
  });

  test("[TC-CHAT-025] a word nobody has finds nothing", async () => {
    await seedChat("บิลคุณสมชาย", null, null);

    expect(await listedTitles("ไม่มีคำนี้")).toEqual([]);
  });

  test.each([".*", "(", "["])("[TC-CHAT-025] the special text %j is searched as letters: no match, no error", async (query) => {
    await seedChat("บิลคุณสมชาย", null, null);

    expect(await listedTitles(query)).toEqual([]);
  });

  test("a special character that is in a title is found as a letter", async () => {
    await seedChat("บิล (ด่วน) [ใหม่]", null, null);
    await seedChat("บิลธรรมดา", null, null);

    expect(await listedTitles("(ด่วน)")).toEqual(["บิล (ด่วน) [ใหม่]"]);
  });
});
