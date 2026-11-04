import { todayInBangkok, type ThaiDate } from "@/features/thai-date/thai-date";

const STALE_YEARS = 5;

const dayNumber = ({ yearBE, month, day }: ThaiDate) => yearBE * 10_000 + month * 100 + day;

// "over 5 years" is counted in Bangkok calendar days: exactly 5 years back is not stale (TC-NFR-021, edge still รอยืนยัน)
export function isStaleChat(updatedAt: string, now: Date): boolean {
  const edited = new Date(updatedAt);
  if (Number.isNaN(edited.getTime())) return false; // the index keeps "" for a chat with no updatedAt
  return dayNumber(todayInBangkok(edited)) + STALE_YEARS * 10_000 < dayNumber(todayInBangkok(now));
}
