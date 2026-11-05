import path from "node:path";
import type { ChatSummary } from "@/features/storage/chat-index";
import type { Store } from "@/features/storage/store";
import { cleanTitle, countChars } from "./chat-title";

const MAX_RENAME_CHARS = 80; // visible characters (FR-CHAT-060)
const EMPTY_ERROR = "ใส่ชื่ออย่างน้อย 1 ตัวอักษร";
const TOO_LONG_ERROR = `ชื่อยาวได้ไม่เกิน ${MAX_RENAME_CHARS} ตัวอักษร`;

// the same check runs in the dialog and on the server; input from outside is cleaned like a title made from a message
export function checkRenameTitle(raw: unknown): { title: string } | { error: string } {
  if (typeof raw !== "string") return { error: EMPTY_ERROR };
  if (raw.length > MAX_RENAME_CHARS * 10) return { error: TOO_LONG_ERROR }; // length first: counting a huge text is slow
  const title = cleanTitle(raw);
  if (title === "") return { error: EMPTY_ERROR };
  return countChars(title) > MAX_RENAME_CHARS ? { error: TOO_LONG_ERROR } : { title };
}

export function renameChat(store: Store, chatId: string, title: string, now: Date = new Date()) {
  return store.withChatLock(chatId, async () => {
    const file = path.join(store.chatDir(chatId), "chat.json");
    const chat = await store.readJson<ChatSummary>(file);
    const updated = { ...chat, title, updatedAt: now.toISOString() };
    await store.writeJsonAtomic(file, updated);
    await store.upsertIndex(updated);
    return { id: updated.id, title: updated.title, updatedAt: updated.updatedAt };
  });
}
