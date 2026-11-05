import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createChat } from "@/features/chat/chats";
import { createStore } from "@/features/storage/store";
import { confirmShop, readShop } from "./shop-store";
import { cashShop } from "./test-kit";

let dir: string;
let chatId: string;
const fail = (code: string) => Object.assign(new Error("boom /secret/path"), { code });

beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-shopstore-"));
  chatId = (await createChat(createStore(dir))).id;
});
afterEach(() => fsp.rm(dir, { recursive: true, force: true }));

describe("shop store with a file system that fails", () => {
  test("[FR-HDR-100] a read error that is not a missing or damaged file is thrown, and the confirmed shop is not overwritten", async () => {
    const shop = await confirmShop(createStore(dir), chatId, cashShop);
    const shopFile = path.join(dir, "shops", shop.id, "shop.json");
    const before = await fsp.readFile(shopFile, "utf8");
    const locked = createStore(dir, { ...fsp, readFile: ((file: string, ...rest: unknown[]) => (String(file).endsWith("shop.json") ? Promise.reject(fail("EBUSY")) : (fsp.readFile as Function)(file, ...rest))) as typeof fsp.readFile });

    await expect(confirmShop(locked, chatId, { ...cashShop, shopName: "ร้านปลอม" })).rejects.toMatchObject({ code: "EBUSY" });
    await expect(readShop(locked, chatId)).rejects.toMatchObject({ code: "EBUSY" });

    expect(await fsp.readFile(shopFile, "utf8")).toBe(before);
  });

  test("[review] chat.json cannot be written after shop.json: the shop folder left behind is removed", async () => {
    let renames = 0;
    const failing = createStore(dir, { ...fsp, rename: ((from: string, to: string) => (++renames === 2 ? Promise.reject(fail("EACCES")) : fsp.rename(from, to))) as typeof fsp.rename });

    await expect(confirmShop(failing, chatId, cashShop)).rejects.toMatchObject({ code: "EACCES" });

    expect(await fsp.readdir(path.join(dir, "shops"))).toEqual([]);
    expect(await readShop(createStore(dir), chatId)).toBeNull();
  });
});
