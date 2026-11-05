import { totalsOf } from "./draft-totals";
import { formatBaht } from "./net-notices";
import type { Draft, DraftItem } from "./types";

function lineReason({ qty, unitPrice }: DraftItem, number: number): string | null {
  if (unitPrice === null) return `บรรทัด ${number} ยังไม่มีราคา ใส่ราคาก่อนออกบิล`;
  if (qty === null) return `บรรทัด ${number} ยังไม่มีจำนวน ใส่จำนวนก่อนออกบิล`;
  return null;
}

/** Why the bill cannot be issued yet, as fixed Thai texts; empty = it can (FR-TOT-120, FR-TOT-140). Server-side gate for the issue route (row 42). */
export function issueBlockers(draft: Draft): string[] {
  const lineReasons = draft.items.map((item, i) => lineReason(item, i + 1)).filter((r) => r !== null);
  const { net } = totalsOf(draft);
  return net < 0 ? [...lineReasons, `ยอดสุทธิติดลบ (${formatBaht(net)} บาท) ลดส่วนลดก่อนจึงออกบิลได้`] : lineReasons;
}
