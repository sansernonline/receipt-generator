const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
const MILLION = 1_000_000;

// Reads 1..999,999. isContinued: a higher part (e.g. ล้าน) precedes, so a lone 1 is เอ็ด.
function readBelowMillion(n: number, isContinued: boolean): string {
  const digits = String(n).split("").map(Number);
  return digits
    .map((digit, i) => {
      const place = digits.length - 1 - i;
      if (digit === 0) return "";
      if (place === 1) return (digit === 1 ? "" : digit === 2 ? "ยี่" : DIGITS[digit]) + PLACES[1];
      if (place === 0 && digit === 1) return n > 1 || isContinued ? "เอ็ด" : "หนึ่ง";
      return DIGITS[digit] + PLACES[place];
    })
    .join("");
}

function readNumber(n: number, isContinued = false): string {
  if (n < MILLION) return n === 0 ? "" : readBelowMillion(n, isContinued);
  const millions = Math.floor(n / MILLION);
  return readNumber(millions) + "ล้าน" + readNumber(n % MILLION, true);
}

/** Thai baht text of an amount given in satang (non-negative integer). Under 1 baht reads satang only. */
export function bahtText(satang: number): string {
  if (!Number.isSafeInteger(satang) || satang < 0) throw new RangeError("satang must be a non-negative integer");
  const baht = Math.floor(satang / 100);
  const fraction = satang % 100;
  if (satang === 0) return "ศูนย์บาทถ้วน";
  const bahtPart = baht > 0 ? readNumber(baht) + "บาท" : "";
  return bahtPart + (fraction > 0 ? readNumber(fraction) + "สตางค์" : "ถ้วน");
}
