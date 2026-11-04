import { detectImageType, type ImageType } from "./image-type";

// SRS says "10 MB" without defining MB (TC-HDR-004 รอยืนยัน); 1,048,576 per MB chosen
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MESSAGES = {
  EMPTY: "ไฟล์ว่าง ไม่มีข้อมูลรูป",
  TOO_LARGE: "ไฟล์ใหญ่เกิน 10 MB",
  WRONG_TYPE: "รับเฉพาะ JPG PNG WEBP",
} as const;

export type UploadError = { ok: false; code: keyof typeof MESSAGES; message: string };
export type UploadCheck = { ok: true; type: ImageType } | UploadError;

const fail = (code: keyof typeof MESSAGES): UploadError => ({ ok: false, code, message: MESSAGES[code] });

// bytes = start of the file (a few dozen bytes is enough); size = full size
export function validateUpload({ bytes, size }: { bytes: Uint8Array; size: number }): UploadCheck {
  if (size === 0) return fail("EMPTY");
  if (size > MAX_UPLOAD_BYTES) return fail("TOO_LARGE");
  const type = detectImageType(bytes);
  return type ? { ok: true, type } : fail("WRONG_TYPE");
}
