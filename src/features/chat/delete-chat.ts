import type { Store } from "@/features/storage/store";

// the folder (all the customer data) goes first; if only the index step fails the next read rebuilds the index from the folders
export function deleteChat(store: Store, chatId: string) {
  return store.withChatLock(chatId, async () => {
    await store.removeChat(chatId);
    await store.removeFromIndex(chatId);
  });
}
