import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { POST as sendRoute } from "@/app/api/chats/[id]/messages/route";
import { createChat } from "@/features/chat/chats";
import { addUserMessage } from "@/features/chat/messages";
import { createStore } from "@/features/storage/store";

let dataDir: string;
const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };
const readChat = async (id: string) => JSON.parse(await fsp.readFile(path.join(dataDir, "chats", id, "chat.json"), "utf8"));
const texts = (count: number) => Array.from({ length: count }, (_, i) => `ข้อความ ${i}`);

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-lock-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

test("20 messages sent at the same time into one chat are all kept, in the order they were sent", async () => {
  const store = createStore(dataDir);
  const { id } = await createChat(store);

  await Promise.all(texts(20).map((text) => addUserMessage(store, id, text)));

  expect((await readChat(id)).messages.map((m: { text: string }) => m.text)).toEqual(texts(20));
});

test("20 simultaneous requests: every one answers 201 and every answered message is on disk", async () => {
  const { id } = await createChat(createStore(dataDir));
  const send = (text: string) => sendRoute(new Request("http://localhost/x", { method: "POST", headers, body: JSON.stringify({ text }) }), { params: Promise.resolve({ id }) });

  const responses = await Promise.all(texts(20).map(send));

  expect(responses.map((r) => r.status)).toEqual(Array(20).fill(201));
  expect((await readChat(id)).messages).toHaveLength(20);
});

test("a failure while updating the index after the message is saved does not fail the send, and the list is rebuilt right", async () => {
  const failingIndex = { ...fsp, open: (file: string, flags: string) => (String(file).includes("index.json") ? Promise.reject(new Error("disk full")) : fsp.open(file, flags)) } as typeof fsp;
  const store = createStore(dataDir, failingIndex);
  const { id } = await createChat(createStore(dataDir));

  const result = await addUserMessage(store, id, "ชื่อใหม่");

  expect(result.chat.title).toBe("ชื่อใหม่");
  expect((await readChat(id)).messages).toHaveLength(1);
  expect((await createStore(dataDir).readIndex()).chats.find((c) => c.id === id)?.title).toBe("ชื่อใหม่");
});

test("with 300 chats a new message touches only its own chat.json and the index, never every chat", async () => {
  const plain = createStore(dataDir);
  await Promise.all(Array.from({ length: 300 }, () => createChat(plain)));
  const { id } = await createChat(plain);
  const reads: string[] = [];
  const counting = { ...fsp, readFile: (file: string, enc: BufferEncoding) => (reads.push(String(file)), fsp.readFile(file, enc)) } as typeof fsp;
  const store = createStore(dataDir, counting);

  const started = performance.now();
  await addUserMessage(store, id, "สวัสดี");
  const elapsed = performance.now() - started;

  process.stderr.write(`send in a 301-chat store: ${elapsed.toFixed(0)} ms, ${reads.length} file reads\n`);
  expect(reads.filter((file) => file.endsWith("chat.json"))).toHaveLength(1);
  expect((await plain.readIndex()).chats[0]).toMatchObject({ id, title: "สวัสดี" });
}, 60_000);

test("creating a chat does not read the other chats either", async () => {
  const plain = createStore(dataDir);
  await Promise.all(Array.from({ length: 50 }, () => createChat(plain)));
  const reads: string[] = [];
  const counting = { ...fsp, readFile: (file: string, enc: BufferEncoding) => (reads.push(String(file)), fsp.readFile(file, enc)) } as typeof fsp;

  await createChat(createStore(dataDir, counting));

  expect(reads.filter((file) => file.endsWith("chat.json"))).toHaveLength(0);
}, 60_000);

test("creating 10 chats at the same time keeps all 10 in the index", async () => {
  const store = createStore(dataDir);

  await Promise.all(Array.from({ length: 10 }, () => createChat(store)));

  expect((await store.readIndex()).chats).toHaveLength(10);
}, 60_000);
