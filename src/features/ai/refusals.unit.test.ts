import { describe, expect, it } from "vitest";
import { refusalMessage } from "./refusals";

describe("refusalMessage (P-005 table, code picks the text)", () => {
  it.each([
    ["out_of_scope", null, "BILLGEN ช่วยได้เฉพาะเรื่องออกบิล ลองพิมพ์รายการสินค้าหรือสั่งแก้บิลได้เลย"],
    ["internal_info", null, "ข้อมูลภายในของระบบเปิดเผยไม่ได้ ถ้าต้องการแก้บิล พิมพ์บอกได้เลย"],
    ["use_button", "edit_header", 'หัวบิลยืนยันแล้ว แก้ได้ที่ปุ่ม "แก้หัวบิล"'],
    ["use_button", "delete_chat", "ลบแชตได้ที่ปุ่มลบเท่านั้น"],
    ["use_button", "issue_bill", 'กดปุ่ม "ยืนยันออกบิล" เพื่อออกบิล'],
    ["use_button", "undo", 'กดปุ่ม "ย้อนกลับ" เพื่อย้อนการแก้'],
    ["computed_total", null, "ยอดเงินคำนวณจากรายการ ส่วนลด และภาษีให้อัตโนมัติ แก้ได้ที่รายการหรือส่วนลด"],
    ["not_supported", null, "ยังทำเรื่องนี้ในแชตไม่ได้"],
  ])("[TC-AI-017] %s %s", (reason, action, text) => {
    expect(refusalMessage(reason, action)).toBe(text);
  });

  it("[TC-AI-032] the out-of-scope refusal invites the user back to billing", () => {
    expect(refusalMessage("out_of_scope", null)).toContain("ลองพิมพ์รายการสินค้า");
  });
});
