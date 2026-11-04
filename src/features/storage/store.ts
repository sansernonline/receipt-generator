import fsp from "node:fs/promises";
import path from "node:path";
import { readJson, writeJsonAtomic, type FileOps } from "./atomic-file";
import { loadIndex, rebuildIndex, upsertIndexEntry, type ChatSummary } from "./chat-index";
import { getDataDir } from "./data-dir";
import { assertValidId, newId } from "./ids";
import { withLock } from "./lock";

// note: when uploads are built, uploads/<fileId>.<ext> paths must allowlist the extension (ids alone are not enough)
export function createStore(dir: string = getDataDir(), ops: FileOps = fsp) {
  const chatDir = (chatId: string) => {
    assertValidId(chatId);
    return path.join(dir, "chats", chatId);
  };
  const shopDir = (shopId: string) => {
    assertValidId(shopId);
    return path.join(dir, "shops", shopId);
  };

  return {
    dir,
    newId,
    chatDir,
    shopDir,
    readJson: <T>(file: string) => readJson<T>(ops, file),
    writeJsonAtomic: (file: string, data: unknown) => writeJsonAtomic(ops, file, data),
    readIndex: () => loadIndex(ops, dir),
    rebuildIndex: () => rebuildIndex(ops, dir),
    upsertIndex: (chat: ChatSummary) => upsertIndexEntry(ops, dir, chat),
    // every read-modify-write of one chat's files goes through this (messages, rename, delete, AI results)
    withChatLock: <T>(chatId: string, task: () => Promise<T>) => {
      assertValidId(chatId);
      return withLock(`chat:${dir}:${chatId}`, task);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
