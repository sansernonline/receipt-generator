import { MESSAGE_INTERNAL_INFO } from "./messages";

// P-005 table: the AI answers with a code, and the text the user reads comes from here (FR-AI-060 · 070 · 110).
// The out-of-scope and internal-info texts end by steering the user back to billing.
const BY_ACTION: Record<string, string> = {
  edit_header: 'หัวบิลยืนยันแล้ว แก้ได้ที่ปุ่ม "แก้หัวบิล"', // FR-HDR-100
  delete_chat: "ลบแชตได้ที่ปุ่มลบเท่านั้น", // FR-CHAT-070
  issue_bill: 'กดปุ่ม "ยืนยันออกบิล" เพื่อออกบิล', // FR-DOC-030
  undo: 'กดปุ่ม "ย้อนกลับ" เพื่อย้อนการแก้', // FR-ITEM-120
};

const BY_REASON: Record<string, string> = {
  out_of_scope: "BILLGEN ช่วยได้เฉพาะเรื่องออกบิล ลองพิมพ์รายการสินค้าหรือสั่งแก้บิลได้เลย",
  internal_info: MESSAGE_INTERNAL_INFO,
  computed_total: "ยอดเงินคำนวณจากรายการ ส่วนลด และภาษีให้อัตโนมัติ แก้ได้ที่รายการหรือส่วนลด", // FR-TOT-020
  not_supported: "ยังทำเรื่องนี้ในแชตไม่ได้", // wording not confirmed yet (PROMPT-LIBRARY P-005)
};

export function refusalMessage(reason: string | null, action: string | null): string {
  if (reason === "use_button" && action) return BY_ACTION[action];
  return BY_REASON[reason ?? ""] ?? BY_REASON.not_supported;
}
