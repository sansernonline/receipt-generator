import path from "node:path";
import { readJson, writeJsonAtomic, type FileOps } from "./atomic-file";
import { isValidId } from "./ids";
import { withLock } from "./lock";

export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
  shopId: string | null;
  billNumber: string | null;
  customerName: string | null;
};

export type ChatIndex = { chats: ChatSummary[] };

export const toSummary = (chat: ChatSummary): ChatSummary => ({
  id: chat.id,
  title: chat.title,
  updatedAt: typeof chat.updatedAt === "string" ? chat.updatedAt : "", // keep the chat listed (last) rather than hide it
  shopId: chat.shopId ?? null,
  billNumber: chat.billNumber ?? null,
  customerName: chat.customerName ?? null,
});

async function listChatIds(ops: FileOps, dir: string): Promise<string[]> {
  const names = await ops.readdir(path.join(dir, "chats")).catch(() => [] as string[]);
  return names.filter(isValidId);
}

// folders are the truth; a chat.json that cannot be read is skipped, not fatal
async function rebuildUnlocked(ops: FileOps, dir: string): Promise<ChatIndex> {
  const chats: ChatSummary[] = [];
  for (const id of await listChatIds(ops, dir)) {
    const chat = await readJson<ChatSummary>(ops, path.join(dir, "chats", id, "chat.json")).catch(() => null);
    if (chat?.id === id) chats.push(toSummary(chat));
  }
  const index = { chats: chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
  await writeJsonAtomic(ops, path.join(dir, "index.json"), index);
  return index;
}

const indexLock = (dir: string) => `index:${dir}`;

export const rebuildIndex = (ops: FileOps, dir: string) => withLock(indexLock(dir), () => rebuildUnlocked(ops, dir));

// change one row instead of reading every chat; never throws, because the chat file is already saved (ARCH 4.1 rule 3)
export function upsertIndexEntry(ops: FileOps, dir: string, chat: ChatSummary): Promise<void> {
  const file = path.join(dir, "index.json");
  return withLock(indexLock(dir), async () => {
    try {
      const index = await readJson<ChatIndex>(ops, file).catch(() => null);
      if (!Array.isArray(index?.chats)) return void (await rebuildUnlocked(ops, dir));
      const chats = [toSummary(chat), ...index.chats.filter((row) => row.id !== chat.id)];
      await writeJsonAtomic(ops, file, { chats: chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    } catch {
      await ops.rm(file, { force: true }).catch(() => undefined); // no index -> the next read rebuilds it
    }
  });
}

// ARCH 4.1 rule 3: index missing, corrupt or not matching chats/ -> rebuild from the folder
export async function loadIndex(ops: FileOps, dir: string): Promise<ChatIndex> {
  const index = await readJson<ChatIndex>(ops, path.join(dir, "index.json")).catch(() => null);
  if (!Array.isArray(index?.chats)) return rebuildIndex(ops, dir);
  const indexed = index.chats.map((chat) => chat.id).sort();
  const onDisk = (await listChatIds(ops, dir)).sort();
  const isMatching = indexed.length === onDisk.length && indexed.every((id, i) => id === onDisk[i]);
  return isMatching ? index : rebuildIndex(ops, dir);
}
