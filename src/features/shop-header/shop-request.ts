import type { VatMode } from "@/features/totals/types";
import type { ShopFields } from "./types";
import { parseShopFields } from "./validate-shop";

const VAT_MODES: VatMode[] = ["none", "exclusive", "inclusive"];

/** What "ใช้หัวบิลนี้" sends: the shop, plus the tax mode the draft starts with (it is not part of shop.json). */
export type ShopRequest = { fields: ShopFields; vatMode?: VatMode };
export type ShopRequestResult = { ok: true; value: ShopRequest } | { ok: false; error: string };

const BAD_SHOP = "ข้อมูลหัวบิลไม่ถูกต้อง";

/** The confirm request body is outside data: the fields are read by parseShopFields, the extras are checked here. */
export function parseShopRequest(raw: unknown): ShopRequestResult {
  const fields = parseShopFields(raw);
  if (!fields) return { ok: false, error: BAD_SHOP };
  const vatMode = Object.hasOwn(raw as object, "vatMode") ? (raw as Record<string, unknown>).vatMode : undefined;
  if (vatMode === undefined) return { ok: true, value: { fields } };
  return VAT_MODES.includes(vatMode as VatMode) ? { ok: true, value: { fields, vatMode: vatMode as VatMode } } : { ok: false, error: BAD_SHOP };
}
