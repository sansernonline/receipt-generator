import { validateUpload } from "./validate-upload";

const MB = 1024 * 1024;
const HEAD_BYTES = 16; // the file type is read from the first bytes only (image-type.ts)

const ADVICE = {
  EMPTY: "เลือกไฟล์อื่นแล้วแนบอีกครั้ง",
  TOO_LARGE: "ย่อขนาดรูปหรือถ่ายใหม่ให้เล็กกว่า 10 MB แล้วแนบอีกครั้ง",
  WRONG_TYPE: "แปลงเป็น JPG หรือ PNG แล้วแนบอีกครั้ง",
} as const;

/** Browser side of the upload check (mockup #s-err-size · #s-err-type): the Thai text to show, or null when the file may go. The server checks again. */
export async function attachProblem(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const check = validateUpload({ bytes, size: file.size });
  if (check.ok) return null;
  const size = check.code === "TOO_LARGE" ? ` (ไฟล์นี้ ${(file.size / MB).toFixed(1)} MB)` : "";
  return `${check.message}${size} ${ADVICE[check.code]}`;
}
