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
