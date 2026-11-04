export type DiscountKind = "percent" | "amount";
export type Discount = { kind: DiscountKind; value: number };

export type VatMode = "none" | "exclusive" | "inclusive";
export type VatSetting = { mode: VatMode; rate: number };

/** Amounts are in baht (2 decimals). One VAT rate for the whole bill (RULE-CALC-080). */
export type LineInput = { quantity: number; unitPrice: number; discount?: Discount };
export type BillDraftLike = { lines: LineInput[]; vat: VatSetting; discount?: Discount };

export type LineTotals = { gross: number; discount: number; amount: number };
export type BillTotals = {
  lines: LineTotals[];
  subtotal: number;
  billDiscount: number;
  afterDiscount: number;
  priceBeforeTax: number;
  vat: number;
  net: number;
};

export const DEFAULT_VAT_RATE = 7;
