export type ImageType = "jpg" | "png" | "webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const WEBP_HEAD_SIZE = 12;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, i) => bytes[offset + i] === value);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

// type comes from the first bytes only; file name and client MIME are never trusted
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, JPEG_SIGNATURE)) return "jpg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  const isWebp = bytes.length >= WEBP_HEAD_SIZE && startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8);
  return isWebp ? "webp" : null;
}
