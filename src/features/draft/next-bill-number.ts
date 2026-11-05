const isDigit = (c: string) => c >= "0" && c <= "9";

/** The bill number after `last`: its trailing digits plus one, keeping leading zeros. null when there are no trailing digits (FR-HDR-130). */
export function nextBillNumber(last: string | null): string | null {
  if (!last) return null;
  let start = last.length;
  while (start > 0 && isDigit(last[start - 1])) start--; // one pass from the end: a regex backtracks on long input
  if (start === last.length) return null;
  const digits = last.slice(start);
  return last.slice(0, start) + String(BigInt(digits) + 1n).padStart(digits.length, "0");
}
