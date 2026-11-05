import path from "node:path";
import { titleFromMessage } from "@/features/chat/chat-title";
import type { Store } from "@/features/storage/store";

export const MAX_MESSAGE_CHARS = 10_000; // visible characters; size guard for input that arrives from outside

type StoredChat = { id: string; title: string; updatedAt: string; shopId: string | null; billNumber: string | null; customerName: string | null; messages: { role: string; text: string; createdAt: string }[] };

// read-modify-write runs inside the per-chat lock, so messages sent at the same time are all kept
export function addUserMessage(store: Store, chatId: string, text: string, now: Date = new Date()) {
  return store.withChatLock(chatId, async () => {
    const file = path.join(store.chatDir(chatId), "chat.json");
    const chat = await store.readJson<StoredChat>(file);
    const message = { role: "user" as const, text, createdAt: now.toISOString() };
    const isFirst = chat.messages.length === 0;
    const updated = { ...chat, title: isFirst ? titleFromMessage(text) : chat.title, updatedAt: message.createdAt, messages: [...chat.messages, message] };
    await store.writeJsonAtomic(file, updated);
    await store.upsertIndex(updated);
    return { chat: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt }, message };
  });
}

/** The messages before this one: what the AI may read as history (the message itself goes in on its own). */
export async function historyBefore(store: Store, chatId: string, message: { text: string; createdAt: string }) {
  const chat = await store.readJson<{ messages: { role: "user" | "assistant"; text: string; createdAt: string }[] }>(path.join(store.chatDir(chatId), "chat.json"));
  return chat.messages.filter((m) => !(m.createdAt === message.createdAt && m.text === message.text));
}
