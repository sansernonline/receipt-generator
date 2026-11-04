import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";

const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("detectImageType", () => {
  it("[TC-HDR-001] detects JPEG from FF D8 FF", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe("jpg");
  });

  it("[TC-HDR-002] detects PNG from the 8-byte signature", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
  });

  it("[TC-HDR-002] detects WEBP from RIFF....WEBP", () => {
    const head = [...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")];
    expect(detectImageType(Uint8Array.from(head))).toBe("webp");
  });

  it("[TC-HDR-005] rejects GIF", () => {
    expect(detectImageType(Uint8Array.from(ascii("GIF89a...")))).toBeNull();
  });

  it("[TC-HDR-006] rejects RIFF that is not WEBP (WAV)", () => {
    expect(detectImageType(Uint8Array.from([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")]))).toBeNull();
  });

  it("[TC-HDR-006] rejects short and empty input", () => {
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});
