import { parseBill } from "@/features/bill/fetch-bill";
import type { BillData } from "@/features/bill/types";
import type { ShopFields, ShopProposal } from "./types";

export type FieldMessages = Partial<Record<keyof ShopFields, string>>;
export type SubmitResult = { ok: true; bill: BillData } | { ok: false; message: string; fields: FieldMessages };

const FAILED = "ใช้หัวบิลไม่สำเร็จ ลองอีกครั้ง";
const FIELD_NAMES: (keyof ShopFields)[] = ["shopName", "address", "taxId", "phone", "email", "template"];

// only known field names with text values are kept: the answer is outside data
function readFieldMessages(raw: unknown): FieldMessages {
  const fields: FieldMessages = {};
  if (typeof raw !== "object" || raw === null) return fields;
  for (const name of FIELD_NAMES) {
    const message = Object.hasOwn(raw, name) ? (raw as Record<string, unknown>)[name] : undefined;
    if (typeof message === "string") fields[name] = message;
  }
  return fields;
}

// what goes to the server: the card's fields and its tax mode; the AI's doubts stay in the browser
function bodyOf({ uncertain: _doubts, ...fields }: ShopProposal) {
  return { ...fields, vatMode: fields.vatMode ?? "none" };
}

/** The user's "ใช้หัวบิลนี้": the server checks the fields again and answers with the bill data that now has the shop. */
export async function submitShop(chatId: string, shop: ShopProposal): Promise<SubmitResult> {
  try {
    const res = await fetch(`/api/chats/${chatId}/shop`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(bodyOf(shop)) });
    const body = await res.json().catch(() => null);
    const bill = res.ok ? parseBill(body) : null;
    if (bill) return { ok: true, bill };
    return { ok: false, message: typeof body?.error === "string" ? body.error : FAILED, fields: readFieldMessages(body?.fields) };
  } catch {
    return { ok: false, message: FAILED, fields: {} };
  }
}
