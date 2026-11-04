import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "./validate-upload";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF = Uint8Array.from([..."GIF89a"].map((c) => c.charCodeAt(0)));
const MB = 1024 * 1024;

describe("validateUpload", () => {
  it("[TC-HDR-001] accepts a 2 MB JPG", () => {
    expect(validateUpload({ bytes: JPG, size: 2 * MB })).toEqual({ ok: true, type: "jpg" });
  });

  it("[TC-HDR-002] accepts a 3 MB PNG", () => {
    expect(validateUpload({ bytes: PNG, size: 3 * MB })).toEqual({ ok: true, type: "png" });
  });

  it("[TC-HDR-003] rejects an 11 MB PNG with the 10 MB message", () => {
    const result = validateUpload({ bytes: PNG, size: 11 * MB });

    expect(result).toEqual({ ok: false, code: "TOO_LARGE", message: "ไฟล์ใหญ่เกิน 10 MB" });
  });

  it("[TC-HDR-004] accepts 9,999,999 bytes", () => {
    expect(validateUpload({ bytes: PNG, size: 9_999_999 })).toMatchObject({ ok: true });
  });

  it("[TC-HDR-004] rejects 10,485,761 bytes", () => {
    expect(validateUpload({ bytes: PNG, size: 10_485_761 })).toMatchObject({ ok: false, code: "TOO_LARGE" });
  });

  it("[TC-HDR-004] limit is 10 * 1,048,576 bytes", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10_485_760);
  });

  it.todo("[TC-HDR-004] 10,000,001-10,485,760 bytes: SRS does not define MB (รอยืนยัน); code accepts per 10*1024*1024");

  it("[TC-HDR-005] rejects GIF with the type message", () => {
    const result = validateUpload({ bytes: GIF, size: 100 * 1024 });

    expect(result).toEqual({ ok: false, code: "WRONG_TYPE", message: "รับเฉพาะ JPG PNG WEBP" });
  });

  it("[TC-HDR-006] rejects fake .jpg whose bytes are GIF", () => {
    expect(validateUpload({ bytes: GIF, size: 50 })).toMatchObject({ ok: false, code: "WRONG_TYPE" });
  });

  it("[TC-HDR-006] rejects an empty file", () => {
    expect(validateUpload({ bytes: new Uint8Array(), size: 0 })).toMatchObject({ ok: false, code: "EMPTY" });
  });

  it("[TC-HDR-006] error messages are Thai and carry no path or stack", () => {
    const result = validateUpload({ bytes: GIF, size: 5 });

    expect(JSON.stringify(result)).not.toMatch(/[\/]|\bat \w+|Error/);
  });
});
