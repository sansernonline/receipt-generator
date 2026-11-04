export type ChatStage = "no-shop" | "no-items" | "has-items";

// fillText = the chip puts this text in the message box; no fillText = no behaviour yet, so the chip stays disabled
export type QuickChip = { label: string; fillText?: string };

// wording follows the mockup chipsFor(); stage 2 and 3 wording is still รอยืนยัน (QS-07)
// simple: the mockup's "เลือกหัวร้านที่บันทึกไว้" chip waits for saved shops (FR-HDR-090)
const CHIPS: Record<ChatStage, QuickChip[]> = {
  "no-shop": [
    { label: "ส่งรูปบิลตัวอย่าง" }, // waits for the attach button (FR-HDR-010 screen)
    { label: "พิมพ์ข้อมูลร้าน", fillText: "ร้านกาแฟบ้านสวน 12/3 ถ.สุขุมวิท ชลบุรี โทร 038-123456 ออกบิลเงินสด" },
  ],
  "no-items": [
    { label: "ส่งรูปรายการ" },
    { label: "พิมพ์รายการตัวอย่าง", fillText: "กาแฟเย็น 3 แก้ว 55, ครัวซองต์ 2 ชิ้น 65" },
  ],
  // these send a command to the AI (rows 17+)
  "has-items": ["ลดท้ายบิล 10%", "VAT ไม่มี", "VAT รวมในราคา", "VAT แยกนอก", "ล้างรายการ"].map((label) => ({ label })),
};

export const chipsFor = (stage: ChatStage): QuickChip[] => CHIPS[stage];

export function stageOf(chat: { shopId: string | null }, draft: { items?: unknown[] } | undefined): ChatStage {
  if (chat.shopId === null) return "no-shop";
  return draft?.items?.length ? "has-items" : "no-items";
}
