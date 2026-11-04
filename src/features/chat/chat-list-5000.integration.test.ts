import { randomUUID } from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { GET } from "@/app/api/chats/route";

const CHAT_COUNT = 5000;
const OPEN_BUDGET_MS = 2000; // TC-NFR-005 (the value is still marked รอยืนยัน in the TC)
const RUNS = 20;
let dataDir: string;

// fake data as the TC asks: 6 messages and a 5-line draft per chat, edited over the last 400 days
async function seed() {
  const day = 24 * 60 * 60 * 1000;
  const messages = Array.from({ length: 6 }, (_, i) => ({ role: "user", text: `ข้อความ ${i}`, createdAt: "2026-10-18T00:00:00Z" }));
  const draft = { items: Array.from({ length: 5 }, (_, i) => ({ name: `สินค้า ${i}`, qty: 1 })), bill: { customerName: null, billNumber: null } };
  for (let start = 0; start < CHAT_COUNT; start += 100) {
    await Promise.all(
      Array.from({ length: 100 }, async (_, k) => {
        const id = randomUUID();
        const updatedAt = new Date(Date.now() - ((start + k) % 400) * day).toISOString();
        const dir = path.join(dataDir, "chats", id);
        await fsp.mkdir(dir, { recursive: true });
        const chat = { id, title: `แชต ${start + k}`, createdAt: updatedAt, updatedAt, shopId: null, billNumber: null, customerName: null, messages };
        await fsp.writeFile(path.join(dir, "chat.json"), JSON.stringify(chat));
        await fsp.writeFile(path.join(dir, "draft.json"), JSON.stringify(draft));
      }),
    );
  }
}

beforeAll(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-5000-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
  await seed();
  await GET(); // the first call builds index.json from the folders; step 2 of the TC times that on its own
}, 300_000);

afterAll(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

test(`[TC-NFR-005] with ${CHAT_COUNT} chats the list answers within ${OPEN_BUDGET_MS} ms, ${RUNS} times in a row`, async () => {
  const timings: number[] = [];

  for (let run = 0; run < RUNS; run++) {
    const started = performance.now();
    const body = await (await GET()).json();
    timings.push(performance.now() - started);
    expect(body.chats).toHaveLength(CHAT_COUNT);
  }

  const average = timings.reduce((a, b) => a + b) / RUNS;
  process.stderr.write(`TC-NFR-005 list ms: max ${Math.max(...timings).toFixed(0)} · avg ${average.toFixed(0)}\n`);
  expect(Math.max(...timings)).toBeLessThan(OPEN_BUDGET_MS);
}, 120_000);

test(`[TC-NFR-005] deleting index.json rebuilds all ${CHAT_COUNT} chats from chats/ (time is recorded, the SRS gives no limit)`, async () => {
  await fsp.rm(path.join(dataDir, "index.json"));

  const started = performance.now();
  const body = await (await GET()).json();
  const elapsed = performance.now() - started;

  process.stderr.write(`TC-NFR-005 rebuild ms: ${elapsed.toFixed(0)}\n`);
  expect(body.chats).toHaveLength(CHAT_COUNT);
}, 120_000);
