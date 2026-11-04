import path from "node:path";
import type { Store } from "@/features/storage/store";

type StoredChat = { id: string; title: string; updatedAt: string; shopId: string | null; messages: { role: string; text: string }[] };

// reads only the two known files for this id; a missing folder surfaces as ENOENT for the route to turn into 404
export async function openChat(store: Store, chatId: string) {
  const dir = store.chatDir(chatId);
  const { id, title, updatedAt, shopId, messages } = await store.readJson<StoredChat>(path.join(dir, "chat.json"));
  const draft = await store.readJson<unknown>(path.join(dir, "draft.json"));
  return { chat: { id, title, updatedAt, shopId, messages }, draft };
}
