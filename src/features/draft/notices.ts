// Fixed Thai texts for a batch of operations that was refused. Nothing from the AI is put in them.
export const NOTICE_HEADER_BY_BUTTON = 'หัวบิลยืนยันแล้ว แก้ได้ที่ปุ่ม "แก้หัวบิล"'; // FR-HDR-100
export const NOTICE_TOTAL_IS_COMPUTED = "ยอดรวม ภาษี และยอดสุทธิระบบคำนวณเอง ตั้งตรง ๆ ไม่ได้ ร่างบิลไม่เปลี่ยน"; // FR-TOT-020
export const NOTICE_NOT_SUPPORTED = "คำสั่งนี้ทำไม่ได้ ร่างบิลไม่เปลี่ยน";
export const NOTICE_BAD_VALUE = "ค่าในคำสั่งใช้ไม่ได้ ร่างบิลไม่เปลี่ยน";
export const NOTICE_BAD_PAYMENT_METHOD = "วิธีชำระมี 3 ชนิด คือ เงินสด โอน หรือเช็ค ร่างบิลไม่เปลี่ยน"; // FR-TOT-080 (wording not confirmed yet)
export const NOTICE_REMARKS_TOO_LONG = "หมายเหตุยาวได้สูงสุด 500 ตัวอักษร ร่างบิลไม่เปลี่ยน"; // FR-TOT-090
export const NOTICE_TOO_MANY_OPERATIONS = "คำสั่งมากเกินไปในครั้งเดียว ร่างบิลไม่เปลี่ยน ลองแบ่งเป็นหลายข้อความ";
// neutral on purpose: the failure can come after draft.json was already written
export const NOTICE_SAVE_FAILED = "บันทึกไม่ครบ ตรวจร่างบิลก่อนสั่งต่อ";
export const NOTICE_DRAFT_CHANGED = "ร่างเปลี่ยนระหว่างรอ ลองสั่งอีกครั้ง";
