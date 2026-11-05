import type { BillData } from "./types";

/** The server's draft + totals pair, or null when the data does not have that shape (a reply from the server is outside data: check it). */
export function parseBill(raw: unknown): BillData | null {
  const { draft, totals } = (raw ?? {}) as Partial<BillData>;
  return Array.isArray(draft?.items) && Array.isArray(totals?.lines) ? { draft, totals } : null;
}

export async function fetchBill(chatId: string): Promise<BillData> {
  const res = await fetch(`/api/chats/${chatId}/draft`);
  const bill = res.ok ? parseBill(await res.json().catch(() => null)) : null;
  if (!bill) throw new Error("bill failed");
  return bill;
}
