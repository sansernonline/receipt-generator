import { readShop } from "@/features/shop-header/shop-store";
import type { Store } from "@/features/storage/store";
import { totalsOf } from "./draft-totals";
import { readDraft } from "./send-message";

/** The chat's draft with the totals the server computes from it and its shop header (null = none yet), same as a sent message answers with. */
export async function openDraft(store: Store, chatId: string) {
  const draft = await readDraft(store, chatId);
  return { draft, totals: totalsOf(draft), shop: await readShop(store, chatId) };
}
