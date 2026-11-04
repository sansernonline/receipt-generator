import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStore } from "../storage/store";
import { MAX_UPLOAD_BYTES } from "./validate-upload";
import { saveOriginalImage } from "./original-image";

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("saveOriginalImage guards", () => {
  it("refuses an image over the size limit even if the caller skipped validateUpload", async () => {
    const store = createStore(await mkdtemp(path.join(tmpdir(), "billgen-up-")));
    const chatId = store.newId();
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(PNG_HEAD);
    await expect(saveOriginalImage(store, chatId, big)).rejects.toThrow();
  });

  it("leaves no temp file behind after a successful save", async () => {
    const store = createStore(await mkdtemp(path.join(tmpdir(), "billgen-up-")));
    const chatId = store.newId();
    const { fileName } = await saveOriginalImage(store, chatId, new Uint8Array([...PNG_HEAD, 1, 2, 3]));
    const files = await readdir(path.join(store.chatDir(chatId), "uploads"));
    expect(files).toEqual([fileName]);
  });
});
