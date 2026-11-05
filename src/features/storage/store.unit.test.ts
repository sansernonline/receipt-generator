import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FileOps } from "./atomic-file";
import { DATA_DIR_ENV, getDataDir } from "./data-dir";
import { isValidId } from "./ids";
import { createStore } from "./store";

let dir: string;
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-store-"));
});
afterEach(() => fsp.rm(dir, { recursive: true, force: true }));

const chatOf = (id: string, updatedAt: string) => ({
  id,
  title: "t",
  updatedAt,
  shopId: null,
  billNumber: "INV-1",
  customerName: "A",
});

async function seedChat(store: ReturnType<typeof createStore>, updatedAt = "2026-01-01T00:00:00Z") {
  const id = store.newId();
  await store.writeJsonAtomic(path.join(store.chatDir(id), "chat.json"), chatOf(id, updatedAt));
  return id;
}

describe("write and read", () => {
  it("[TC-CHAT-026] writes a message file that a fresh store reads back within 2 seconds", async () => {
    const id = await seedChat(createStore(dir));
    const file = path.join(dir, "chats", id, "chat.json");
    const started = Date.now();

    await createStore(dir).writeJsonAtomic(file, { id, messages: ["กาแฟเย็น 3 แก้ว 55 บาท"] });
    const read = await createStore(dir).readJson<{ messages: string[] }>(file);

    expect(read.messages).toEqual(["กาแฟเย็น 3 แก้ว 55 บาท"]);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("[TC-CHAT-027] keeps the old file whole and leaves no temp file when the rename fails", async () => {
    const failing: FileOps = { ...fsp, rename: () => Promise.reject(Object.assign(new Error("boom"), { code: "EACCES" })) };
    const id = await seedChat(createStore(dir));
    const file = path.join(dir, "chats", id, "chat.json");
    const before = await fsp.readFile(file, "utf8");

    await expect(createStore(dir, failing).writeJsonAtomic(file, { id, messages: [1, 2, 3] })).rejects.toThrow("boom");

    expect(await fsp.readFile(file, "utf8")).toBe(before);
    expect(await fsp.readdir(path.dirname(file))).toEqual(["chat.json"]);
  });

  it("retries rename once on EPERM then succeeds", async () => {
    let calls = 0;
    const flaky: FileOps = {
      ...fsp,
      rename: (from, to) =>
        ++calls === 1 ? Promise.reject(Object.assign(new Error("locked"), { code: "EPERM" })) : fsp.rename(from, to),
    };
    const file = path.join(dir, "a.json");

    await createStore(dir, flaky).writeJsonAtomic(file, { ok: true });

    expect(JSON.parse(await fsp.readFile(file, "utf8"))).toEqual({ ok: true });
  });
});

describe("ids and paths", () => {
  it("accepts a random UUID and builds the chat folder inside the data dir", () => {
    const store = createStore(dir);
    const id = store.newId();

    expect(isValidId(id)).toBe(true);
    expect(store.chatDir(id)).toBe(path.join(dir, "chats", id));
  });

  it.each(["../x", "..\\x", "a/b", "", "C:\\x", "not-a-uuid"])("rejects id %j before touching the filesystem", (bad) => {
    const store = createStore(dir);

    expect(() => store.chatDir(bad)).toThrow("invalid id");
    expect(() => store.shopDir(bad)).toThrow("invalid id");
  });
});

describe("index", () => {
  it("rebuilds the index from chats/ when index.json is missing, newest first", async () => {
    const store = createStore(dir);
    const older = await seedChat(store, "2026-01-01T00:00:00Z");
    const newer = await seedChat(store, "2026-02-01T00:00:00Z");

    const index = await store.readIndex();

    expect(index.chats.map((c) => c.id)).toEqual([newer, older]);
    expect(JSON.parse(await fsp.readFile(path.join(dir, "index.json"), "utf8")).chats).toHaveLength(2);
  });

  it("rebuilds when index.json is corrupt", async () => {
    const store = createStore(dir);
    const id = await seedChat(store);
    await fsp.writeFile(path.join(dir, "index.json"), "{not json");

    expect((await store.readIndex()).chats.map((c) => c.id)).toEqual([id]);
  });

  it("rebuilds when the index does not match the chat folders", async () => {
    const store = createStore(dir);
    await seedChat(store);
    await store.readIndex();
    const added = await seedChat(store);

    expect((await store.readIndex()).chats.map((c) => c.id)).toContain(added);
  });

  it("keeps a chat whose chat.json has no updatedAt, listed last", async () => {
    const store = createStore(dir);
    const dated = await seedChat(store, "2026-01-01T00:00:00Z");
    const undated = store.newId();
    await store.writeJsonAtomic(path.join(store.chatDir(undated), "chat.json"), { id: undated, title: "t" });

    expect((await store.rebuildIndex()).chats.map((c) => c.id)).toEqual([dated, undated]);
  });

  it("skips folders that are not ids or have no readable chat.json", async () => {
    const store = createStore(dir);
    const id = await seedChat(store);
    await fsp.mkdir(path.join(dir, "chats", "not-an-id"));
    await fsp.mkdir(path.join(dir, "chats", store.newId()));

    expect((await store.rebuildIndex()).chats.map((c) => c.id)).toEqual([id]);
  });
});

describe("removing a chat", () => {
  it("removeChat deletes the whole chat folder and nothing else", async () => {
    const store = createStore(dir);
    const gone = await seedChat(store);
    const kept = await seedChat(store);
    await fsp.mkdir(path.join(store.chatDir(gone), "uploads"), { recursive: true });
    await fsp.writeFile(path.join(store.chatDir(gone), "uploads", "a.png"), "x");

    await store.removeChat(gone);

    expect(await fsp.readdir(path.join(dir, "chats"))).toEqual([kept]);
  });

  it("removeChat on a folder that is already gone does not throw", async () => {
    const store = createStore(dir);

    await expect(store.removeChat(store.newId())).resolves.toBeUndefined();
  });

  it("removeChat refuses an id that is not a UUID", async () => {
    await expect(createStore(dir).removeChat("..")).rejects.toThrow("invalid id");
  });

  it("removeFromIndex drops one row and keeps the others in order", async () => {
    const store = createStore(dir);
    const older = await seedChat(store, "2026-01-01T00:00:00Z");
    const middle = await seedChat(store, "2026-02-01T00:00:00Z");
    const newer = await seedChat(store, "2026-03-01T00:00:00Z");
    await store.rebuildIndex();

    await store.removeFromIndex(middle);

    const rows = JSON.parse(await fsp.readFile(path.join(dir, "index.json"), "utf8")).chats;
    expect(rows.map((row: { id: string }) => row.id)).toEqual([newer, older]);
  });

  it("removeFromIndex with a missing or corrupt index leaves a list that matches the folders", async () => {
    const store = createStore(dir);
    const kept = await seedChat(store);
    await fsp.writeFile(path.join(dir, "index.json"), "{not json");

    await store.removeFromIndex(store.newId());

    expect((await store.readIndex()).chats.map((c) => c.id)).toEqual([kept]);
  });
});

describe("data dir", () => {
  it("uses BILLGEN_DATA_DIR when set", () => {
    expect(getDataDir({ [DATA_DIR_ENV]: dir })).toBe(path.resolve(dir));
  });

  it("falls back to .billgen-data inside the code folder outside production", () => {
    expect(getDataDir({ NODE_ENV: "development" })).toBe(path.resolve(process.cwd(), ".billgen-data"));
  });

  it("throws a clear error in production when BILLGEN_DATA_DIR is not set", () => {
    expect(() => getDataDir({ NODE_ENV: "production" })).toThrow(DATA_DIR_ENV);
  });
});

describe("restart", () => {
  it("[TC-NFR-007] a new store over the same dir sees every saved chat with identical file content", async () => {
    const first = createStore(dir);
    const ids = await Promise.all(Array.from({ length: 50 }, () => seedChat(first)));
    const read = (id: string) => fsp.readFile(path.join(dir, "chats", id, "chat.json"), "utf8");
    const before = await Promise.all(ids.map(read));

    const restarted = createStore(dir);
    const after = await Promise.all(ids.map(read));

    expect(after).toEqual(before);
    expect((await restarted.readIndex()).chats).toHaveLength(50);
  });

  it.todo("[TC-NFR-007] 10 real server restarts keep 100% of chats (needs a running server; integration later)");
  it.todo("[TC-NFR-008] AI outage (500, no reply, disconnect) x10 keeps saved chats (needs chat route and AI stub)");
});
