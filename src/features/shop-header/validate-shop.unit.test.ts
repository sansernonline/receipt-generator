import { describe, expect, it } from "vitest";
import { checkShop, parseShopFields } from "./validate-shop";
import type { ShopFields } from "./types";

const shop = (taxId: string): ShopFields => ({ shopName: "ร้านกาแฟบ้านสวน", address: "", taxId, phone: "", email: "", template: "cash" });

describe("tax id of the shop (TC-HDR-025)", () => {
  it.each([
    ["12 digits", "010556000000"],
    ["14 digits", "01055600000012"],
    ["a letter", "01055600000AB"],
  ])("[TC-HDR-025] %s is refused with the 13-digit text", (_name, taxId) => {
    const { errors } = checkShop(shop(taxId));

    expect(errors.taxId).toBe("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก");
  });

  it("[TC-HDR-025] 13 digits with a wrong check digit is allowed but warned", () => {
    const { errors, warnings } = checkShop(shop("0105560000001"));

    expect(errors).toEqual({});
    expect(warnings.taxId).toContain("หลักที่ 13");
  });

  it("[TC-HDR-025] 13 digits with the right check digit has no error and no warning", () => {
    expect(checkShop(shop("0105560000000"))).toEqual({ errors: {}, warnings: {} });
  });

  it("[TC-HDR-025] an empty tax id is allowed", () => {
    expect(checkShop(shop(""))).toEqual({ errors: {}, warnings: {} });
  });
});

describe("shop fields (FR-HDR-080)", () => {
  it("[FR-HDR-080] an empty shop name is refused", () => {
    expect(checkShop({ ...shop(""), shopName: "  " }).errors.shopName).toBe("ใส่ชื่อร้านก่อนใช้หัวบิล");
  });

  it("[FR-HDR-080] a text longer than 500 characters is refused", () => {
    expect(checkShop({ ...shop(""), address: "ก".repeat(501) }).errors.address).toBeDefined();
  });
});

describe("parseShopFields reads the body of the confirm request", () => {
  it("keeps the known fields trimmed", () => {
    const body = { ...shop("0105560000000"), shopName: "  ร้านกาแฟบ้านสวน  " };

    expect(parseShopFields(body)?.shopName).toBe("ร้านกาแฟบ้านสวน");
  });

  it.each([
    ["not an object", "x"],
    ["an array", []],
    ["a number in a text field", { ...shop(""), shopName: 123 }],
    ["a template that does not exist", { ...shop(""), template: "quote" }],
    ["a missing field", { shopName: "ร้าน" }],
  ])("returns null for %s", (_name, body) => {
    expect(parseShopFields(body)).toBeNull();
  });

  it("does not read a field the object only inherits", () => {
    const inherited = Object.create({ ...shop("") });

    expect(parseShopFields(inherited)).toBeNull();
  });

  it("drops fields it does not know, such as an id", () => {
    expect(parseShopFields({ ...shop(""), id: "x", extra: 1 })).not.toHaveProperty("id");
  });
});
