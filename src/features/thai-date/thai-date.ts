export type ThaiDate = { day: number; month: number; yearBE: number };

const BUDDHIST_YEAR_OFFSET = 543;

const bangkokParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function todayInBangkok(now: Date): ThaiDate {
  const part = (type: string) =>
    Number(bangkokParts.formatToParts(now).find((p) => p.type === type)?.value);
  return { day: part("day"), month: part("month"), yearBE: part("year") + BUDDHIST_YEAR_OFFSET };
}

export function formatThaiDate({ day, month, yearBE }: ThaiDate): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(day)}/${pad(month)}/${yearBE}`;
}

export function resolveBillDate(given: ThaiDate | undefined, now: Date): ThaiDate {
  return given ?? todayInBangkok(now);
}

type DateParts = { d: number; m: number; y: number | null; era: "BE" | "CE" | null };

const isLeapYear = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

/** False for a day that does not exist. With no year, 29 Feb is allowed. */
export function isRealDate({ d, m, y, era }: DateParts): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const yearCE = y === null ? 2000 : era === "BE" ? y - BUDDHIST_YEAR_OFFSET : y;
  const daysInMonth = [31, isLeapYear(yearCE) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= daysInMonth;
}
