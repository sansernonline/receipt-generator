import fsp from "node:fs/promises";
import path from "node:path";
import type { ChatSummary } from "@/features/storage/chat-index";
import type { Store } from "@/features/storage/store";
import { isValidId } from "@/features/storage/ids";
import type { ShopFields, ShopHeader } from "./types";
import { parseShopFields } from "./validate-shop";

// the whole chat.json is read and written back, so fields this file does not know (messages) stay
type StoredChat = ChatSummary & Record<string, unknown>;

/** The chat's shop header already stands; only the edit button may change it (FR-HDR-100 · 110). */
export class ShopLockedError extends Error {}

const chatFile = (store: Store, chatId: string) => path.join(store.chatDir(chatId), "chat.json");
const shopFile = (store: Store, shopId: string) => path.join(store.shopDir(shopId), "shop.json");

// A shop id whose file is missing or damaged counts as no shop, so the user can set it again instead of being locked out.
// Any other read error (a Windows file lock) is thrown: it must never look like "no shop", or a confirmed header could be overwritten (FR-HDR-100)
async function loadShop(store: Store, shopId: unknown): Promise<ShopHeader | null> {
  if (!isValidId(shopId)) return null;
  const raw = await store.readJson<unknown>(shopFile(store, shopId)).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  });
  const fields = parseShopFields(raw);
  return fields && { id: shopId, ...fields };
}

/** The confirmed shop header of the chat, or null when there is none (or its file is missing or damaged). */
export async function readShop(store: Store, chatId: string): Promise<ShopHeader | null> {
  const { shopId } = await store.readJson<StoredChat>(chatFile(store, chatId));
  return loadShop(store, shopId);
}

/** Called only by the user's "ใช้หัวบิลนี้" button, with fields the route has already checked (ADR-0006). */
export function confirmShop(store: Store, chatId: string, fields: ShopFields): Promise<ShopHeader> {
  return store.withChatLock(chatId, async () => {
    const chat = await store.readJson<StoredChat>(chatFile(store, chatId));
    if (await loadShop(store, chat.shopId)) throw new ShopLockedError();
    const shop: ShopHeader = { id: store.newId(), ...fields };
    await store.writeJsonAtomic(shopFile(store, shop.id), shop);
    const updated = { ...chat, shopId: shop.id };
    try {
      await store.writeJsonAtomic(chatFile(store, chatId), updated);
    } catch (error) {
      await fsp.rm(store.shopDir(shop.id), { recursive: true, force: true }).catch(() => undefined); // best effort: no orphan file
      throw error;
    }
    await store.upsertIndex(updated);
    return shop;
  });
}
