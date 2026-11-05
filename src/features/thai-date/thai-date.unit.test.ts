import { afterEach, describe, expect, it } from "vitest";
import { formatThaiDate, isRealDate, resolveBillDate, todayInBangkok } from "./thai-date";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

const format = (iso: string) => formatThaiDate(todayInBangkok(new Date(iso)));

describe("thai-date", () => {
  it("[TC-HDR-040] uses today at noon Bangkok time", () => {
    expect(format("2026-10-18T12:00:00+07:00")).toBe("18/10/2569");
  });

  it("[TC-HDR-041] uses the Bangkok date, not UTC, at 00:30 Bangkok time", () => {
    expect(format("2026-10-19T00:30:00+07:00")).toBe("19/10/2569");
  });

  it("[TC-HDR-042] rolls over exactly at Bangkok midnight", () => {
    expect(format("2026-10-18T23:59:59+07:00")).toBe("18/10/2569");
    expect(format("2026-10-19T00:00:00+07:00")).toBe("19/10/2569");
  });

  it("[TC-HDR-043] keeps the date the user gave instead of today", () => {
    const now = new Date("2026-10-18T12:00:00+07:00");
    const given = { day: 5, month: 10, yearBE: 2569 };

    expect(formatThaiDate(resolveBillDate(given, now))).toBe("05/10/2569");
  });

  it("[TC-HDR-043] falls back to today when no date is given", () => {
    const now = new Date("2026-10-18T12:00:00+07:00");

    expect(formatThaiDate(resolveBillDate(undefined, now))).toBe("18/10/2569");
  });

  it.each([
    ["2026-10-18T12:00:00+07:00", "18/10/2569"],
    ["2026-01-01T00:00:00+07:00", "01/01/2569"],
    ["2026-12-31T23:59:00+07:00", "31/12/2569"],
    ["2024-02-29T12:00:00+07:00", "29/02/2567"],
  ])("[TC-NFR-026] %s -> %s in UTC and New York machine zones", (iso, expected) => {
    for (const tz of ["UTC", "America/New_York"]) {
      process.env.TZ = tz;
      expect(format(iso)).toBe(expected);
    }
  });
});

describe("isRealDate", () => {
  it.each([
    [{ d: 31, m: 2, y: 2569, era: "BE" }, false],
    [{ d: 29, m: 2, y: 2568, era: "BE" }, false],
    [{ d: 29, m: 2, y: 2567, era: "BE" }, true],
    [{ d: 29, m: 2, y: 2024, era: "CE" }, true],
    [{ d: 29, m: 2, y: 2100, era: "CE" }, false],
    [{ d: 31, m: 4, y: null, era: null }, false],
    [{ d: 29, m: 2, y: null, era: null }, true],
    [{ d: 29, m: 2, y: 0, era: "CE" }, true],
    [{ d: 29, m: 2, y: 543, era: "BE" }, true],
  ] as const)("[TC-HDR-036] %j is %s", (date, expected) => {
    expect(isRealDate(date)).toBe(expected);
  });
});
