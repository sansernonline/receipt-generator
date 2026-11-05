import { DEFAULT_VAT_RATE, type Discount, type VatSetting } from "@/features/totals/types";
import type { BillInfo, DateParts, Draft, DraftItem, Footer, PaymentMethod } from "./types";

export const MAX_ITEMS = 200; // FR-ITEM-100

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
// own keys only: a stored file with "__proto__" or "constructor" must not read inherited values
const own = (raw: Raw, key: string): unknown => (Object.hasOwn(raw, key) ? raw[key] : undefined);
const asText = (v: unknown) => (typeof v === "string" ? v : null);
const asNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseDate(v: unknown): DateParts | null {
  if (!isRecord(v)) return null;
  const [d, m, y] = [own(v, "d"), own(v, "m"), own(v, "y")];
  const era = own(v, "era");
  if (!Number.isInteger(d) || !Number.isInteger(m)) return null;
  if (y === null && era === null) return { d: d as number, m: m as number, y: null, era: null };
  if (!Number.isInteger(y) || (era !== "BE" && era !== "CE")) return null;
  return { d: d as number, m: m as number, y: y as number, era };
}

// A stored value that calcTotals would refuse is read as "not set", so a damaged file never makes the route throw.
// validate-reply is the first gate for what the AI sends; this only guards what is read back from disk.
function parseDiscount(v: unknown): Discount | null {
  if (!isRecord(v)) return null;
  const [kind, value] = [own(v, "kind"), asNumber(own(v, "value"))];
  if ((kind !== "amount" && kind !== "percent") || value === null || value < 0) return null;
  return kind === "percent" && value > 100 ? null : { kind, value };
}

function parseVat(v: unknown): VatSetting {
  const fallback: VatSetting = { mode: "none", rate: DEFAULT_VAT_RATE };
  if (!isRecord(v)) return fallback;
  const [mode, rate] = [own(v, "mode"), asNumber(own(v, "rate"))];
  if (rate !== null && rate < 0) return fallback;
  return mode === "none" || mode === "exclusive" || mode === "inclusive" ? { mode, rate: rate ?? DEFAULT_VAT_RATE } : fallback;
}

function parseItem(v: unknown): DraftItem | null {
  const name = isRecord(v) ? asText(own(v, "name")) : null;
  if (!isRecord(v) || name === null) return null;
  const [qty, unitPrice] = [asNumber(own(v, "qty")), asNumber(own(v, "unitPrice"))];
  const usableQty = qty !== null && qty > 0 ? qty : null;
  const usablePrice = unitPrice !== null && unitPrice >= 0 ? unitPrice : null;
  const discount = parseDiscount(own(v, "discount"));
  const isTooBig = discount?.kind === "amount" && usableQty !== null && usablePrice !== null && discount.value > usableQty * usablePrice;
  return {
    code: asText(own(v, "code")), name, description: asText(own(v, "description")),
    qty: usableQty, unit: asText(own(v, "unit")), unitPrice: usablePrice, discount: isTooBig ? null : discount,
  };
}

const BILL_TEXT_KEYS = ["customerName", "customerAddress", "customerTaxId", "customerPhone", "customerEmail", "billNumber", "ref", "quoteRef", "quotedBy"] as const;

function parseBill(v: unknown): BillInfo {
  const raw = isRecord(v) ? v : {};
  const bill = emptyDraft().bill;
  for (const key of BILL_TEXT_KEYS) bill[key] = asText(own(raw, key));
  bill.billDate = parseDate(own(raw, "billDate"));
  bill.dueDate = parseDate(own(raw, "dueDate"));
  return bill;
}

function parseFooter(v: unknown): Footer {
  const raw = isRecord(v) ? v : {};
  const method = own(raw, "paymentMethod");
  const paymentMethod: PaymentMethod | null = method === "cash" || method === "transfer" || method === "cheque" ? method : null;
  return {
    vat: parseVat(own(raw, "vat")), discount: parseDiscount(own(raw, "discount")), paymentMethod,
    paymentDate: parseDate(own(raw, "paymentDate")), paymentDetail: asText(own(raw, "paymentDetail")), remarks: asText(own(raw, "remarks")),
  };
}

export const emptyDraft = (): Draft => ({
  items: [],
  bill: {
    customerName: null, customerAddress: null, customerTaxId: null, customerPhone: null, customerEmail: null,
    billNumber: null, billDate: null, ref: null, dueDate: null, quoteRef: null, quotedBy: null,
  },
  footer: { vat: { mode: "none", rate: DEFAULT_VAT_RATE }, discount: null, paymentMethod: null, paymentDate: null, paymentDetail: null, remarks: null },
});

/** Reads draft.json (any older shape too). Only known fields are kept, so stored totals can never come back as input. */
export function parseDraft(raw: unknown): Draft {
  const items = isRecord(raw) ? own(raw, "items") : undefined;
  if (!isRecord(raw) || !Array.isArray(items)) return emptyDraft();
  return {
    items: items.map(parseItem).filter((item): item is DraftItem => item !== null).slice(0, MAX_ITEMS), // a damaged file with more is cut, not trusted
    bill: parseBill(own(raw, "bill")),
    footer: parseFooter(own(raw, "footer")),
  };
}
