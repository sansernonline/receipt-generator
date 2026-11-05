import type { ShopFields } from "./types";

// Made-up shop (TESTPLAN 3.2): the tax id has the right check digit, the phone is not a real number
export const cashShop: ShopFields = {
  shopName: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี", taxId: "0105560000000", phone: "038-123456", email: "", template: "cash",
};

/** The AI's answer for "ร้านกาแฟบ้านสวน 12/3 ถ.สุขุมวิท ชลบุรี โทร 038-123456 ออกบิลเงินสด" (PROMPT-LIBRARY P-002 good example). */
export const shopReplyBody = (over: Record<string, unknown> = {}, headerOver: Record<string, unknown> = {}) => ({
  status: "ok",
  reason: null,
  header: {
    doc_type: "cash_bill", title_th: "บิลเงินสด", title_en: null, shop_name: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี",
    tax_id: null, branch: null, phone: "038-123456", email: null, doc_no_sample: null, vat_mode: null, ...headerOver,
  },
  has_bill_content: false,
  uncertain: [],
  note: null,
  ...over,
});

/** The AI's answer to a picture (PROMPT-LIBRARY P-001 good example: a cash bill of the same made-up shop). */
export const shopImageReplyBody = (over: Record<string, unknown> = {}, headerOver: Record<string, unknown> = {}) => ({
  status: "ok",
  reason: null,
  header: {
    doc_type: "cash_bill", title_th: "บิลเงินสด", title_en: null, shop_name: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี",
    tax_id: "0105560000000", branch: null, phone: "038-123456", email: null, doc_no_sample: "เล่มที่ 3 เลขที่ 041", vat_mode: null, ...headerOver,
  },
  uncertain: [],
  note: null,
  ...over,
});
