import { describe, expect, it } from "vitest";
import { nextBillNumber } from "./next-bill-number";

describe("nextBillNumber", () => {
  it("[TC-HDR-037] RC-2569-0041 gives RC-2569-0042", () => {
    expect(nextBillNumber("RC-2569-0041")).toBe("RC-2569-0042");
  });

  it.each([
    ["RC-2569-0099", "RC-2569-0100"],
    ["RC-2569-0999", "RC-2569-1000"],
  ])("[TC-HDR-038] %s gives %s, no leading zero lost", (last, expected) => {
    expect(nextBillNumber(last)).toBe(expected);
  });

  it("[TC-HDR-038] a full 4 digit number grows by one digit (the SRS does not say, awaiting confirmation)", () => {
    expect(nextBillNumber("RC-2569-9999")).toBe("RC-2569-10000");
  });

  it.each([["ABC"], [""], [null]])("[TC-HDR-039] %j has no trailing digits, nothing is guessed", (last) => {
    expect(nextBillNumber(last)).toBeNull();
  });

  it("counts a number longer than a safe integer without rounding", () => {
    expect(nextBillNumber("A12345678901234567890")).toBe("A12345678901234567891");
  });

  it("takes the trailing digits after a line break", () => {
    expect(nextBillNumber("A\n1")).toBe("A\n2");
  });

  it("answers a 100,000 character string quickly", () => {
    const start = Date.now();

    nextBillNumber("1".repeat(100_000) + "a");

    expect(Date.now() - start).toBeLessThan(500);
  });
});
