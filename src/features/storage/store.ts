import fsp from "node:fs/promises";
import path from "node:path";
import { readJson, writeJsonAtomic, type FileOps } from "./atomic-file";
import { loadIndex, rebuildIndex, removeIndexEntry, upsertIndexEntry, type ChatSummary } from "./chat-index";
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
    removeFromIndex: (chatId: string) => removeIndexEntry(ops, dir, chatId),
    // retries: Windows can hold a file for a moment (antivirus, indexer); the customer data must really go (NFR-PDPA-020)
    removeChat: async (chatId: string) => ops.rm(chatDir(chatId), { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }),
    // every read-modify-write of one chat's files goes through this (messages, rename, delete, AI results)
    withChatLock: <T>(chatId: string, task: () => Promise<T>) => {
      assertValidId(chatId);
      return withLock(`chat:${dir}:${chatId}`, task);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
