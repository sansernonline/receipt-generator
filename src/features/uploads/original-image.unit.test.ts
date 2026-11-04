import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStore } from "../storage/store";
import { loadOriginalImage, saveOriginalImage } from "./original-image";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);
const UUID_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

let dir: string;
let store: ReturnType<typeof createStore>;
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-uploads-"));
  store = createStore(dir);
});
afterEach(() => fsp.rm(dir, { recursive: true, force: true }));

describe("saveOriginalImage", () => {
  it("[TC-HDR-001] stores uploads/<uuid>.<ext> in the chat folder, bytes unchanged", async () => {
    const chatId = store.newId();

    const saved = await saveOriginalImage(store, chatId, PNG);

    expect(saved.fileName).toMatch(UUID_NAME);
    const onDisk = await fsp.readFile(path.join(store.chatDir(chatId), "uploads", saved.fileName));
    expect(new Uint8Array(onDisk)).toEqual(PNG);
  });

  it("[TC-HDR-001] two saves get different random names", async () => {
    const chatId = store.newId();

    const a = await saveOriginalImage(store, chatId, PNG);
    const b = await saveOriginalImage(store, chatId, PNG);

    expect(a.fileName).not.toBe(b.fileName);
  });

  it("[TC-HDR-006] refuses bytes that are not an image and writes nothing", async () => {
    const chatId = store.newId();

    await expect(saveOriginalImage(store, chatId, Uint8Array.from([71, 73, 70, 56]))).rejects.toThrow();

    await expect(fsp.readdir(path.join(store.chatDir(chatId), "uploads"))).rejects.toThrow();
  });

  it("rejects a chat id that is not a uuid (path traversal)", async () => {
    await expect(saveOriginalImage(store, "../../evil", PNG)).rejects.toThrow("invalid id");
  });
});

describe("loadOriginalImage", () => {
  it("[TC-HDR-044] returns the saved bytes and type", async () => {
    const chatId = store.newId();
    const { fileName } = await saveOriginalImage(store, chatId, PNG);

    const loaded = await loadOriginalImage(store, chatId, fileName);

    expect(loaded.ok && new Uint8Array(loaded.bytes)).toEqual(PNG);
  });

  it("[TC-HDR-045] returns IMAGE_MISSING when the file is gone", async () => {
    const chatId = store.newId();
    const { fileName } = await saveOriginalImage(store, chatId, PNG);
    await fsp.rm(path.join(store.chatDir(chatId), "uploads", fileName));

    const loaded = await loadOriginalImage(store, chatId, fileName);

    expect(loaded).toEqual({ ok: false, code: "IMAGE_MISSING", message: "ไม่พบไฟล์รูปตัวอย่าง" });
  });

  it("[TC-HDR-045] a file name with traversal is treated as missing, never read", async () => {
    const chatId = store.newId();

    const loaded = await loadOriginalImage(store, chatId, "../../../secret.png");

    expect(loaded).toMatchObject({ ok: false, code: "IMAGE_MISSING" });
  });

  it.todo("[TC-HDR-044] reopen chat next day shows the same preview: needs server + UI (row wiring it)");
  it.todo("[TC-HDR-045] chat page opens with a missing-image notice: needs server + UI");
});
