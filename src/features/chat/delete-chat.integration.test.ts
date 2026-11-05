import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE, GET, PATCH } from "@/app/api/chats/[id]/route";
import { POST as sendMessage } from "@/app/api/chats/[id]/messages/route";
import { createChat } from "@/features/chat/chats";
import { addUserMessage } from "@/features/chat/messages";
import { createStore } from "@/features/storage/store";

let dataDir: string;
const ORIGIN = "http://localhost:3000";
const UPLOAD = "11111111-1111-4111-8111-111111111111.png";
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (method: string, headers: Record<string, string>, body?: unknown) =>
  new Request("http://localhost/api/chats/x", { method, headers: { host: "localhost:3000", "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const remove = (id: string, headers: Record<string, string> = { origin: ORIGIN }) => DELETE(request("DELETE", headers), context(id));
const exists = (...parts: string[]) => fsp.access(path.join(dataDir, ...parts)).then(() => true, () => false);

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-delete-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

// every file a chat can own (ARCH 4.1): chat, draft, versions, uploads
async function seedChat(customerName = "คุณสมชาย ใจดี") {
  const store = createStore(dataDir);
  const { id } = await createChat(store);
  const dir = store.chatDir(id);
  await addUserMessage(store, id, `ลูกค้า ${customerName} REF-777`);
  await store.writeJsonAtomic(path.join(dir, "draft.json"), { items: [], bill: { customerName, billNumber: "REF-777", quoter: "คุณวิชัย", transfer: "000-0-00000-0" } });
  await store.writeJsonAtomic(path.join(dir, "versions", "v1.json"), { customerName, quoter: "คุณวิชัย", transfer: "000-0-00000-0" });
  await fsp.mkdir(path.join(dir, "uploads"), { recursive: true });
  await fsp.writeFile(path.join(dir, "uploads", UPLOAD), "PNGDATA-สมชาย");
  await store.upsertIndex({ id, title: "แชตลูกค้า", updatedAt: new Date().toISOString(), shopId: null, billNumber: "REF-777", customerName });
  return { store, id };
}

async function allFileTexts(dir: string): Promise<string[]> {
  const entries = await fsp.readdir(dir, { withFileTypes: true, recursive: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
  return Promise.all(files.map((file) => fsp.readFile(file, "utf8")));
}

describe("DELETE /api/chats/[id]", () => {
  test("[TC-NFR-017] after the delete no file in the data folder holds the customer data, and the index row is gone", async () => {
    const { store, id } = await seedChat();
    const other = await createChat(store);
    await addUserMessage(store, other.id, "ร้านอื่น");
    const startedAt = Date.now();

    const res = await remove(id);

    expect(res.status).toBe(204);
    expect(Date.now() - startedAt).toBeLessThan(60_000);
    const everything = (await allFileTexts(dataDir)).join("\n");
    for (const secret of ["สมชาย", "REF-777", "วิชัย", "000-0-00000-0"]) expect(everything).not.toContain(secret);
    expect(await exists("chats", id)).toBe(false);
    expect((await store.readIndex()).chats.map((chat) => chat.id)).toEqual([other.id]);
  });

  test("[TC-CHAT-019] the other chats stay complete", async () => {
    const { id } = await seedChat();
    const other = await seedChat("คุณมานี");

    await remove(id);

    expect(await exists("chats", other.id, "chat.json")).toBe(true);
    expect(await exists("chats", other.id, "uploads", UPLOAD)).toBe(true);
  });

  test.each<Record<string, string>>([{}, { origin: "https://evil.example" }])("[TC-CHAT-022] origin %j: 403 and the chat stays", async (headers) => {
    const { store, id } = await seedChat();

    const res = await remove(id, headers);

    expect(res.status).toBe(403);
    expect(await exists("chats", id, "chat.json")).toBe(true);
    expect((await store.readIndex()).chats.map((chat) => chat.id)).toContain(id);
  });

  test("[NFR-SEC-040] a GET never deletes", async () => {
    const { id } = await seedChat();

    await GET(request("GET", {}), context(id));

    expect(await exists("chats", id, "chat.json")).toBe(true);
  });

  test("[TC-CHAT-020] sending the text ลบแชตนี้ keeps every file of the chat", async () => {
    const { id } = await seedChat();

    const res = await sendMessage(request("POST", { origin: ORIGIN }, { text: "ลบแชตนี้" }), context(id));

    expect(res.status).toBe(201);
    for (const file of ["chat.json", "draft.json", path.join("versions", "v1.json"), path.join("uploads", UPLOAD)]) {
      expect(await exists("chats", id, file)).toBe(true);
    }
  });

  test("a bad id is 400 and nothing outside chats/ is touched", async () => {
    await seedChat();
    await fsp.writeFile(path.join(dataDir, "keep.txt"), "x");

    const res = await remove("..");

    expect(res.status).toBe(400);
    expect(await exists("keep.txt")).toBe(true);
    expect(await exists("chats")).toBe(true);
  });

  test("deleting a chat that is already gone is 204 (a second click is harmless)", async () => {
    const { id } = await seedChat();
    await remove(id);

    expect((await remove(id)).status).toBe(204);
  });

  test("a failed delete is 500 with a Thai message and no path, and the chat stays listed", async () => {
    const { store, id } = await seedChat();
    vi.spyOn(fsp, "rm").mockRejectedValueOnce(Object.assign(new Error(`EPERM ${dataDir}`), { code: "EPERM" }));

    const res = await remove(id);

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain(dataDir);
    expect((await store.readIndex()).chats.map((chat) => chat.id)).toContain(id);
  });

  test("a message sent after the delete is 404 and does not bring the folder back", async () => {
    const { id } = await seedChat();
    await remove(id);

    const res = await sendMessage(request("POST", { origin: ORIGIN }, { text: "สาย" }), context(id));

    expect(res.status).toBe(404);
    expect(await exists("chats", id)).toBe(false);
  });

  test("a rename after the delete is 404 and does not bring the folder back", async () => {
    const { id } = await seedChat();
    await remove(id);

    const res = await PATCH(request("PATCH", { origin: ORIGIN }, { title: "สาย" }), context(id));

    expect(res.status).toBe(404);
    expect(await exists("chats", id)).toBe(false);
  });

  test("a message and a delete at the same moment leave no folder and no index row", async () => {
    const { store, id } = await seedChat();

    await Promise.all([addUserMessage(store, id, "พร้อมกัน").catch(() => undefined), remove(id)]);

    expect(await exists("chats", id)).toBe(false);
    expect((await store.readIndex()).chats.map((chat) => chat.id)).not.toContain(id);
  });
});

// the backup copy made before the delete does not exist yet (NFR-REL-030 is built in a later row)
test.todo("[TC-NFR-017] step 3: the backup copy made before the delete still holds the data until 30 days pass");
// no shops/ folder is deleted by a chat delete until Q-14 is decided (BUILD-PLAN row 38)
test.todo("[TC-NFR-018] deleting the last chat that uses a shop header deletes the header within 1 minute (waits on Q-14, row 38)");
// the reply "use the delete button" comes from the AI layer (FR-AI-070)
test.todo("[TC-CHAT-020] step 1: the system replies that deleting is done with the button (needs the AI reply, FR-AI-070)");
