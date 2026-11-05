// Fixed Thai texts the user may see. Nothing from the AI, the network or the config is ever put in them.
export const MESSAGE_INVALID_REPLY = "ยังอ่านคำสั่งไม่ได้ ลองพิมพ์ใหม่"; // FR-AI-100
export const MESSAGE_AI_UNREACHABLE = "ตอนนี้ติดต่อบริการ AI ไม่ได้ ร่างบิลไม่เปลี่ยน ลองใหม่อีกครั้ง"; // FR-AI-030
export const MESSAGE_INTERNAL_INFO = "ข้อมูลภายในของระบบเปิดเผยไม่ได้ ถ้าต้องการแก้บิล พิมพ์บอกได้เลย"; // FR-AI-070
export const MESSAGE_TOO_LONG = "ข้อความยาวได้ไม่เกิน 10,000 ตัวอักษร"; // FR-AI-080
export const MESSAGE_TOO_MANY_IMAGES = "ส่งรูปได้ครั้งละไม่เกิน 20 รูป";
export const messageWaitForImages = (seconds: number) => `อ่านรูปได้ไม่เกิน 20 รูปต่อนาที กรุณารอ ${seconds} วินาทีแล้วส่งใหม่`; // FR-AI-120
export const MESSAGE_TOO_LONG_INPUT = "ข้อมูลที่ส่งยาวเกินไปที่จะอ่านครั้งเดียว ลองส่งทีละน้อย";
export const MESSAGE_PARTIAL_OCR = "(อ่านจากรูปได้บางส่วน เพราะข้อความในรูปยาวเกินไป)";
// P-001 rows "empty" and "unsupported_doc" (PROMPT-LIBRARY ข้อ 3); wording still รอยืนยัน
export const MESSAGE_NO_SHOP_IN_IMAGE = "ไม่พบข้อมูลร้านในรูปนี้ ลองส่งรูปบิลที่เห็นหัวร้านชัด ๆ หรือพิมพ์ข้อมูลร้านในแชตแทน";
export const MESSAGE_UNSUPPORTED_DOC = "เอกสารในรูปไม่ตรงกับแม่แบบที่มี BILLGEN ออกได้ 4 แบบ คือ บิลเงินสด · ใบเสร็จรับเงิน · ใบกำกับภาษี/ใบเสร็จรับเงิน · ใบแจ้งหนี้ ส่งรูปบิลแบบใดแบบหนึ่งนี้ หรือพิมพ์ข้อมูลร้านในแชตแทน";
