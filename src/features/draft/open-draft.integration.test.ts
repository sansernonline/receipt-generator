import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { GET } from "@/app/api/chats/[id]/draft/route";
import { createChat } from "@/features/chat/chats";
import { createStore } from "@/features/storage/store";
import { draftWith } from "./test-kit";

let dataDir: string;
let chatId: string;
const read = (id: string) => GET(new Request(`http://localhost/api/chats/${id}/draft`), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-draft-get-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
  const store = createStore(dataDir);
  chatId = (await createChat(store)).id;
  await store.writeJsonAtomic(path.join(store.chatDir(chatId), "draft.json"), draftWith());
});

afterEach(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

test("[FR-DOC-010] GET draft gives the stored draft and the totals the server computed (net 295.00)", async () => {
  const res = await read(chatId);
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.draft.items.map((item: { name: string }) => item.name)).toEqual(["กาแฟเย็น", "ครัวซองต์"]);
  expect(body.totals.net).toBe(295);
});

test("[FR-DOC-010] GET draft only reads: the draft file is the same afterwards", async () => {
  const file = path.join(dataDir, "chats", chatId, "draft.json");
  const before = await fsp.readFile(file, "utf8");

  await read(chatId);

  expect(await fsp.readFile(file, "utf8")).toBe(before);
});

test("[TC-DOC-003] a new chat has an empty draft and zero totals, not an error", async () => {
  const id = (await createChat(createStore(dataDir))).id;

  const body = await (await read(id)).json();

  expect(body.draft.items).toEqual([]);
  expect(body.totals.net).toBe(0);
});

test("[FR-DOC-010] an id that is not a chat id gets 400 and an unknown chat 404, with Thai text and no path", async () => {
  const bad = await read("../etc");
  const unknown = await read("33333333-3333-4333-8333-333333333333");
  const text = await unknown.text();

  expect(bad.status).toBe(400);
  expect(unknown.status).toBe(404);
  expect(JSON.parse(text)).toEqual({ error: "ไม่พบแชตนี้" });
  expect(text).not.toMatch(/billgen-draft-get|ENOENT|\|draft\.json/);
});
