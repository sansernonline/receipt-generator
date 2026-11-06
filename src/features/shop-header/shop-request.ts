import type { VatMode } from "@/features/totals/types";
import { detectImageType } from "@/features/uploads/image-type";
import type { ShopFields } from "./types";
import { LOGO_PREFIX, parseShopFields } from "./validate-shop";

export const MAX_LOGO_BYTES = 512 * 1024; // self-set: the SRS gives no limit; a logo cut from a bill is far smaller
const VAT_MODES: VatMode[] = ["none", "exclusive", "inclusive"];

/** What "ใช้หัวบิลนี้" sends: the shop, plus the two things that are not part of shop.json. */
export type ShopRequest = { fields: ShopFields; vatMode?: VatMode; logo?: Buffer };
export type ShopRequestResult = { ok: true; value: ShopRequest } | { ok: false; error: string };

const BAD_SHOP = "ข้อมูลหัวบิลไม่ถูกต้อง";
const BAD_LOGO = "โลโก้ไม่ถูกต้อง";

// null = not a usable PNG. The text is checked before it is decoded, so a huge string never becomes a huge buffer.
function decodeLogo(dataUrl: string): Buffer | null {
  const base64 = dataUrl.startsWith(LOGO_PREFIX) ? dataUrl.slice(LOGO_PREFIX.length) : "";
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 4) return null;
  const bytes = Buffer.from(base64, "base64");
  return bytes.length <= MAX_LOGO_BYTES && detectImageType(bytes) === "png" ? bytes : null;
}

const bad = (error: string): ShopRequestResult => ({ ok: false, error });

/** The confirm request body is outside data: the fields are read by parseShopFields, the extras are checked here. */
export function parseShopRequest(raw: unknown): ShopRequestResult {
  const parsed = parseShopFields(raw);
  if (!parsed) return bad(BAD_SHOP);
  const read = (key: string) => (Object.hasOwn(raw as object, key) ? (raw as Record<string, unknown>)[key] : undefined);
  const vatMode = read("vatMode");
  if (vatMode !== undefined && !VAT_MODES.includes(vatMode as VatMode)) return bad(BAD_SHOP);
  const extras = vatMode === undefined ? {} : { vatMode: vatMode as VatMode };

  const logoData = read("logo");
  const { logoCrop: _cropOfNoLogo, ...fields } = parsed; // a crop of a logo that is not used is not kept
  if (logoData === undefined) return { ok: true, value: { fields, ...extras } };
  const logo = typeof logoData === "string" ? decodeLogo(logoData) : null;
  return logo ? { ok: true, value: { fields: parsed, logo, ...extras } } : bad(BAD_LOGO);
}
