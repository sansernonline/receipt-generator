import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET } from "@/app/api/chats/route";
import { POST as sendRoute } from "@/app/api/chats/[id]/messages/route";
import { createStore } from "@/features/storage/store";

const NOW = new Date("2026-10-18T05:00:00Z"); // 18 Oct 2569 12:00 Bangkok
let dataDir: string;

// updatedAt values: 5 years and 1 day before · exactly 5 years before · 4 years 364 days before (same clock time)
const CHATS = {
  "11111111-1111-4111-8111-111111111111": "2021-10-17T05:00:00Z",
  "22222222-2222-4222-8222-222222222222": "2021-10-18T05:00:00Z",
  "33333333-3333-4333-8333-333333333333": "2021-10-19T05:00:00Z",
};
const [OLDER, EXACT, NEWER] = Object.keys(CHATS);

async function seed() {
  const store = createStore(dataDir);
  for (const [id, updatedAt] of Object.entries(CHATS)) {
    const chat = { id, title: id, createdAt: updatedAt, updatedAt, shopId: null, billNumber: null, customerName: null, messages: [] };
    await store.writeJsonAtomic(path.join(store.chatDir(id), "chat.json"), chat);
  }
}
const staleIds = async () => ((await (await GET()).json()).chats as { id: string; isStale: boolean }[]).filter((c) => c.isStale).map((c) => c.id);

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-stale-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
  await seed();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

test("[TC-NFR-021] only the chat last edited more than 5 years ago is marked; exactly 5 years and 4 years 364 days are not", async () => {
  expect(await staleIds()).toEqual([OLDER]);
  expect(await staleIds()).not.toContain(EXACT);
  expect(await staleIds()).not.toContain(NEWER);
});

test("[TC-NFR-021] editing the marked chat clears its marker", async () => {
  const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };

  await sendRoute(new Request("http://localhost/x", { method: "POST", headers, body: JSON.stringify({ text: "แก้ไข" }) }), { params: Promise.resolve({ id: OLDER }) });

  expect(await staleIds()).toEqual([]);
});
