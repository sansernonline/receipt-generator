import path from "node:path";
import type { Store } from "@/features/storage/store";

export const NEW_CHAT_TITLE = "แชตใหม่"; // replaced by the first message later (FR-CHAT-030)

// a new chat never copies anything from another chat (FR-CHAT-120); shopId stays null until the user picks a shop
export async function createChat(store: Store, now: Date = new Date()) {
  const id = store.newId();
  const dir = store.chatDir(id);
  const stamp = now.toISOString();
  const chat = { id, title: NEW_CHAT_TITLE, createdAt: stamp, updatedAt: stamp, shopId: null, billNumber: null, customerName: null, messages: [] };
  // simple: draft shape is the minimum TC-CHAT-033 checks; the bill editing rows extend it
  await store.writeJsonAtomic(path.join(dir, "draft.json"), { items: [], bill: { customerName: null, billNumber: null } });
  await store.writeJsonAtomic(path.join(dir, "chat.json"), chat);
  await store.rebuildIndex();
  return { id, title: chat.title, updatedAt: stamp, shopId: null };
}
