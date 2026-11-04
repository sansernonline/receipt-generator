import { describe, expect, it } from "vitest";
import { bahtText } from "./baht-text";

describe("bahtText (input: satang as integer)", () => {
  it("[TC-TOT-025] reads satang", () => {
    expect(bahtText(26550)).toBe("สองร้อยหกสิบห้าบาทห้าสิบสตางค์");
    expect(bahtText(28409)).toBe("สองร้อยแปดสิบสี่บาทเก้าสตางค์");
  });

  it("[TC-TOT-026] reads whole baht with ถ้วน", () => {
    expect(bahtText(29500)).toBe("สองร้อยเก้าสิบห้าบาทถ้วน");
    expect(bahtText(1070000)).toBe("หนึ่งหมื่นเจ็ดร้อยบาทถ้วน");
    expect(bahtText(1187500)).toBe("หนึ่งหมื่นหนึ่งพันแปดร้อยเจ็ดสิบห้าบาทถ้วน");
  });

  it("[TC-TOT-027] handles เอ็ด ยี่ สิบ", () => {
    expect(bahtText(1100)).toBe("สิบเอ็ดบาทถ้วน");
    expect(bahtText(2100)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(bahtText(10100)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(bahtText(121)).toBe("หนึ่งบาทยี่สิบเอ็ดสตางค์");
    expect(bahtText(5)).toBe("ห้าสตางค์");
    expect(bahtText(21)).toBe("ยี่สิบเอ็ดสตางค์");
    expect(bahtText(1000)).toBe("สิบบาทถ้วน");
    expect(bahtText(2000)).toBe("ยี่สิบบาทถ้วน");
    expect(bahtText(111111)).toBe("หนึ่งพันหนึ่งร้อยสิบเอ็ดบาทสิบเอ็ดสตางค์");
    expect(bahtText(10000000)).toBe("หนึ่งแสนบาทถ้วน");
  });

  it("[TC-TOT-028] reads millions (Q-12 pending: ล้านเอ็ด per SRS)", () => {
    expect(bahtText(100000000)).toBe("หนึ่งล้านบาทถ้วน");
    expect(bahtText(100000100)).toBe("หนึ่งล้านเอ็ดบาทถ้วน");
    expect(bahtText(2100000000)).toBe("ยี่สิบเอ็ดล้านบาทถ้วน");
    expect(bahtText(100000000000)).toBe("หนึ่งพันล้านบาทถ้วน");
    expect(bahtText(1200000000000)).toBe("หนึ่งหมื่นสองพันล้านบาทถ้วน");
    expect(bahtText(100000000000000)).toBe("หนึ่งล้านล้านบาทถ้วน");
  });

  it.todo("[TC-TOT-029] negative amount format is รอยืนยัน in the test case");

  it("[TC-TOT-029] rejects negative and non-integer input instead of reading it as positive", () => {
    expect(() => bahtText(-500)).toThrow(RangeError);
    expect(() => bahtText(1.5)).toThrow(RangeError);
  });

  it("[TC-TOT-054] reads invoice totals", () => {
    expect(bahtText(101650)).toBe("หนึ่งพันสิบหกบาทห้าสิบสตางค์");
    expect(bahtText(106999)).toBe("หนึ่งพันหกสิบเก้าบาทเก้าสิบเก้าสตางค์");
    expect(bahtText(11503)).toBe("หนึ่งร้อยสิบห้าบาทสามสตางค์");
  });

  it("reads zero as ศูนย์บาทถ้วน", () => {
    expect(bahtText(0)).toBe("ศูนย์บาทถ้วน");
  });
});
