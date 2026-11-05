import { calcTotals } from "@/features/totals/calc-totals";
import type { BillTotals, LineInput } from "@/features/totals/types";
import type { Draft, DraftItem } from "./types";

// A line without qty or price counts as 0.00 until the user fills it (FR-TOT-140); it keeps its place so line numbers stay aligned
const NOT_COMPLETE: LineInput = { quantity: 1, unitPrice: 0 };

function lineOf({ qty, unitPrice, discount }: DraftItem): LineInput {
  if (qty === null || unitPrice === null || !(qty > 0)) return NOT_COMPLETE;
  return { quantity: qty, unitPrice, discount: discount ?? undefined };
}

/** Every amount on the bill comes from here, never from the AI (FR-TOT-020). Throws RangeError for an impossible discount. */
export const totalsOf = (draft: Draft): BillTotals =>
  calcTotals({ lines: draft.items.map(lineOf), vat: draft.footer.vat, discount: draft.footer.discount ?? undefined });
