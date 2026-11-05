import { totalsOf } from "./draft-totals";
import type { Draft } from "./types";

// Fixed Thai texts built only from amounts the server computed; the wording follows mockup s-negative (FR-TOT-100, FR-TOT-110)
export const NOTICE_NET_NEGATIVE = "ยอดติดลบ ออกบิลไม่ได้จนกว่าจะแก้ส่วนลด";

export const formatBaht = (baht: number): string => baht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "ก่อน → หลัง" only when the net changed, plus a warning (not an error) while the net is below 0.00. */
export function netNotices(before: Draft, after: Draft): string[] {
  const { net: netBefore } = totalsOf(before);
  const { net: netAfter } = totalsOf(after);
  return [
    ...(netAfter === netBefore ? [] : [`ยอดสุทธิ ${formatBaht(netBefore)} → ${formatBaht(netAfter)} บาท`]),
    ...(netAfter < 0 ? [NOTICE_NET_NEGATIVE] : []),
  ];
}
