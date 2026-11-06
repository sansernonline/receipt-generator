import { TEMPLATES } from "@/features/bill/bill-templates";
import type { LogoCrop, ShopFields, ShopHeader } from "./types";

export type ShopProblems = { errors: Partial<Record<keyof ShopFields, string>>; warnings: Partial<Record<keyof ShopFields, string>> };

const MAX_TEXT = 500; // self-set ceiling, SRS 6.2 gives none
const TEXT_KEYS = ["shopName", "address", "taxId", "phone", "email"] as const;

const TAX_ID_PATTERN = /^\d{13}$/;
const WEIGHTS = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

// 13th digit of a Thai tax id = (11 - sum of first 12 digits x weights 13..2 mod 11) mod 10 (SRS 6.2: formula still รอยืนยัน, so this only warns)
function hasRightCheckDigit(taxId: string): boolean {
  const sum = WEIGHTS.reduce((total, weight, i) => total + weight * Number(taxId[i]), 0);
  return (11 - (sum % 11)) % 10 === Number(taxId[12]);
}

export function checkShop(shop: ShopFields): ShopProblems {
  const problems: ShopProblems = { errors: {}, warnings: {} };
  for (const key of TEXT_KEYS) if (shop[key].length > MAX_TEXT) problems.errors[key] = `ยาวเกิน ${MAX_TEXT} ตัวอักษร`;
  if (shop.shopName.trim() === "") problems.errors.shopName = "ใส่ชื่อร้านก่อนใช้หัวบิล";
  if (shop.taxId !== "" && !TAX_ID_PATTERN.test(shop.taxId)) problems.errors.taxId = "เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก";
  else if (shop.taxId !== "" && !hasRightCheckDigit(shop.taxId)) problems.warnings.taxId = "หลักที่ 13 ไม่ตรงกับการคำนวณ ตรวจเลขอีกครั้ง (ใช้ต่อได้)";
  return problems;
}

/** A colour the browser sent: #rrggbb only, anything else is dropped (it ends up in a style on the bill). */
export const parseAccent = (raw: unknown): string | undefined => (typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : undefined);

export const hasErrors = ({ errors }: ShopProblems) => Object.keys(errors).length > 0;

const MAX_CROP_VALUE = 100_000; // pixels; a self-set ceiling
const isCropValue = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_CROP_VALUE;
const parseCrop = (raw: unknown): LogoCrop | undefined => (Array.isArray(raw) && raw.length === 4 && raw.every(isCropValue) ? (raw as LogoCrop) : undefined);

/** The confirm request body (outside data): every field present with the right type, anything else dropped. null = not a shop. */
export function parseShopFields(raw: unknown): ShopFields | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const read = (key: string) => (Object.hasOwn(raw, key) ? (raw as Record<string, unknown>)[key] : undefined);
  const texts = TEXT_KEYS.map((key) => read(key));
  const template = TEMPLATES.find(({ id }) => id === read("template"))?.id;
  if (texts.some((value) => typeof value !== "string") || !template) return null;
  const [shopName, address, taxId, phone, email] = (texts as string[]).map((value) => value.trim());
  const [accent, logoCrop] = [parseAccent(read("accent")), parseCrop(read("logoCrop"))];
  return { shopName, address, taxId, phone, email, template, ...(accent ? { accent } : {}), ...(logoCrop ? { logoCrop } : {}) };
}

export const LOGO_PREFIX = "data:image/png;base64,";

/** A stored or received shop header (shop.json, the server's answer): the fields as above plus its id, and the logo as a data URL when it has one. */
export function parseShopHeader(raw: unknown): ShopHeader | null {
  const fields = parseShopFields(raw);
  if (!fields) return null;
  const [id, logo] = ["id", "logo"].map((key) => (Object.hasOwn(raw as object, key) ? (raw as Record<string, unknown>)[key] : undefined));
  const hasLogo = typeof logo === "string" && logo.startsWith(LOGO_PREFIX) && /^[A-Za-z0-9+/]+={0,2}$/.test(logo.slice(LOGO_PREFIX.length));
  return typeof id === "string" ? { id, ...fields, ...(hasLogo ? { logo } : {}) } : null;
}
