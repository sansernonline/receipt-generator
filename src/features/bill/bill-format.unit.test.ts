import { expect, test } from "vitest";
import { billDateText, formatMoney } from "./bill-format";

const NOW = new Date("2026-10-18T05:00:00Z"); // 18 Oct 2569 in Bangkok

test("[TC-HDR-034] money shows 2 decimals and thousands commas", () => {
  expect(formatMoney(1016.5)).toBe("1,016.50");
  expect(formatMoney(0)).toBe("0.00");
  expect(formatMoney(-5)).toBe("-5.00");
});

test("[FR-HDR-140] no date shows today in the Buddhist era", () => {
  expect(billDateText(null, NOW)).toBe("18/10/2569");
});

test("[FR-HDR-140] a date without a year takes this year", () => {
  expect(billDateText({ d: 5, m: 3, y: null, era: null }, NOW)).toBe("05/03/2569");
});

test("[FR-HDR-140] a Christian-era year is converted, a Buddhist-era year is kept", () => {
  expect(billDateText({ d: 20, m: 10, y: 2026, era: "CE" }, NOW)).toBe("20/10/2569");
  expect(billDateText({ d: 20, m: 10, y: 2569, era: "BE" }, NOW)).toBe("20/10/2569");
});
