import { parseShopHeader } from "@/features/shop-header/validate-shop";
import type { BillData } from "./types";

/** The server's draft + totals pair, or null when the data does not have that shape (a reply from the server is outside data: check it). */
export function parseBill(raw: unknown): BillData | null {
  const { draft, totals, shop, canUndo } = (raw ?? {}) as Partial<BillData>;
  const isWhole = Array.isArray(draft?.items) && typeof draft.bill === "object" && draft.bill !== null && Array.isArray(totals?.lines) && totals.lines.length === draft.items.length;
  return isWhole ? { draft, totals, shop: parseShopHeader(shop), canUndo: canUndo === true } : null;
}

export async function fetchBill(chatId: string): Promise<BillData> {
  const res = await fetch(`/api/chats/${chatId}/draft`);
  const bill = res.ok ? parseBill(await res.json().catch(() => null)) : null;
  if (!bill) throw new Error("bill failed");
  return bill;
}
