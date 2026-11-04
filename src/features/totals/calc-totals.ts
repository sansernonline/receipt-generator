import { divRoundHalfUp, toBaht, toSatang } from "./money";
import type { BillDraftLike, BillTotals, Discount, LineInput, VatSetting } from "./types";

const PERCENT_SCALE = 10000; // percents are held in hundredths of a percent

const scaledPercent = (percent: number) => Math.round(percent * 100);

function discountSatang(base: number, discount?: Discount) {
  if (!discount) return 0;
  if (discount.kind === "amount") return toSatang(discount.value);
  return divRoundHalfUp(base * scaledPercent(discount.value), PERCENT_SCALE);
}

function lineSatang(line: LineInput) {
  const { quantity, unitPrice } = line;
  if (!(quantity > 0)) throw new RangeError("quantity must be greater than 0");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new RangeError("unit price must be a number, not negative");
  const gross = divRoundHalfUp(Math.round(quantity * 1000) * toSatang(unitPrice), 1000);
  const discount = discountSatang(gross, line.discount);
  if (discount < 0 || discount > gross) throw new RangeError("line discount must be within 0..gross");
  return { gross, discount, amount: gross - discount };
}

function vatSatang({ mode, rate }: VatSetting, afterDiscount: number) {
  if (mode === "none") return 0;
  if (!Number.isFinite(rate) || rate < 0) throw new RangeError("VAT rate must be a number, not negative");
  const scaled = scaledPercent(rate);
  const divisor = mode === "exclusive" ? PERCENT_SCALE : PERCENT_SCALE + scaled;
  return divRoundHalfUp(afterDiscount * scaled, divisor);
}

export function calcTotals(bill: BillDraftLike): BillTotals {
  const lines = bill.lines.map(lineSatang);
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const billDiscount = discountSatang(subtotal, bill.discount);
  const afterDiscount = subtotal - billDiscount;
  const vat = vatSatang(bill.vat, afterDiscount);
  const isInclusive = bill.vat.mode === "inclusive";

  return {
    lines: lines.map((l) => ({ gross: toBaht(l.gross), discount: toBaht(l.discount), amount: toBaht(l.amount) })),
    subtotal: toBaht(subtotal),
    billDiscount: toBaht(billDiscount),
    afterDiscount: toBaht(afterDiscount),
    priceBeforeTax: toBaht(isInclusive ? afterDiscount - vat : afterDiscount),
    vat: toBaht(vat),
    net: toBaht(isInclusive ? afterDiscount : afterDiscount + vat),
  };
}
