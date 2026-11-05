import type { DateParts } from "@/features/draft/types";
import { formatThaiDate, todayInBangkok } from "@/features/thai-date/thai-date";

const BUDDHIST_YEAR_OFFSET = 543;

export const formatMoney = (baht: number): string => baht.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** dd/mm/yyyy in the Buddhist era. A missing date is today and a missing year is this year (FR-HDR-140). */
export function billDateText(date: DateParts | null, now: Date): string {
  const today = todayInBangkok(now);
  if (date === null) return formatThaiDate(today);
  const yearBE = date.y === null ? today.yearBE : date.era === "CE" ? date.y + BUDDHIST_YEAR_OFFSET : date.y;
  return formatThaiDate({ day: date.d, month: date.m, yearBE });
}
