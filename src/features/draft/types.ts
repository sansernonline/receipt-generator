import type { ShopFields, ShopHeader } from "@/features/shop-header/types";
import type { BillTotals, Discount, VatSetting } from "@/features/totals/types";

// Shape of chats/<id>/draft.json (SRS 6.2). The server owns it (ADR-0006); money is in baht with 2 decimals,
// the totals module turns it into satang. qty / unitPrice are null while the line is not complete (FR-TOT-140).
export type DraftItem = {
  code: string | null;
  name: string;
  description: string | null;
  qty: number | null;
  unit: string | null;
  unitPrice: number | null;
  discount: Discount | null;
};

export type DateParts = { d: number; m: number; y: number | null; era: "BE" | "CE" | null };

export type BillInfo = {
  customerName: string | null;
  customerAddress: string | null;
  customerTaxId: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  billNumber: string | null;
  billDate: DateParts | null;
  ref: string | null;
  dueDate: DateParts | null;
  quoteRef: string | null;
  quotedBy: string | null;
};

export type PaymentMethod = "cash" | "transfer" | "cheque";

export type Footer = {
  vat: VatSetting;
  discount: Discount | null;
  paymentMethod: PaymentMethod | null;
  paymentDate: DateParts | null;
  paymentDetail: string | null;
  remarks: string | null;
};

export type Draft = { items: DraftItem[]; bill: BillInfo; footer: Footer };

export type StoredMessage = { role: "user" | "assistant"; text: string; createdAt: string };

/**
 * Response of POST /api/chats/[id]/messages (status 201 once the user message is stored).
 * - messages: what this request added: the user message, plus the assistant reply when the AI answered.
 * - draft / totals: the draft after this request (unchanged when the AI failed or the batch was refused);
 *   totals always come from calcTotals, never from the AI.
 * - notices: Thai texts the UI shows as they are (AI failure, refusal, limits, warnings).
 * - error: machine code (askAi failure code) when the AI gave nothing usable; the Thai text is in notices.
 * - canUndo: there is an edit to take back (FR-ITEM-120); the button is off otherwise.
 * - shop: the chat's confirmed shop header, null until the user presses "ใช้หัวบิลนี้".
 * - shopCard: the AI's proposal for the shop header while the chat has none; the user reviews it, nothing is saved (FR-HDR-070).
 * - shopCardHasBill: the same message also holds customer or items; the browser sends it again once the shop is set (PROMPT-LIBRARY P-002).
 * - chat / message: kept for the first UI (message = the user message).
 */
export type SendMessageResponse = {
  chat: { id: string; title: string; updatedAt: string };
  message: StoredMessage;
  messages: StoredMessage[];
  draft: Draft;
  totals: BillTotals;
  shop: ShopHeader | null;
  shopCard?: ShopFields;
  shopCardHasBill?: true;
  notices: string[];
  canUndo: boolean;
  error?: string;
};
