import { randomUUID } from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Store } from "../storage/store";
import { validateUpload } from "./validate-upload";

const UPLOADS_DIR = "uploads";
const STORED_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export type LoadedImage =
  | { ok: true; bytes: Buffer }
  | { ok: false; code: "IMAGE_MISSING"; message: string };

const uploadsDir = (store: Store, chatId: string) => path.join(store.chatDir(chatId), UPLOADS_DIR);

// the extension comes from the detected type, never from the client file name
export async function saveOriginalImage(store: Store, chatId: string, bytes: Uint8Array) {
  const dir = uploadsDir(store, chatId);
  const check = validateUpload({ bytes, size: bytes.byteLength });
  if (!check.ok) throw new Error(check.message);
  const fileName = `${randomUUID()}.${check.type}`;
  const target = path.join(dir, fileName);
  const temp = `${target}.tmp`;
  await fsp.mkdir(dir, { recursive: true });
  try {
    // write then rename, so a half-written file never has the final name
    await fsp.writeFile(temp, bytes, { flag: "wx" });
    await fsp.rename(temp, target);
  } catch (err) {
    await fsp.rm(temp, { force: true });
    throw err;
  }
  return { fileName, type: check.type };
}

export async function loadOriginalImage(store: Store, chatId: string, fileName: string): Promise<LoadedImage> {
  const missing: LoadedImage = { ok: false, code: "IMAGE_MISSING", message: "ไม่พบไฟล์รูปตัวอย่าง" };
  if (!STORED_NAME.test(fileName)) return missing;
  try {
    return { ok: true, bytes: await fsp.readFile(path.join(uploadsDir(store, chatId), fileName)) };
  } catch {
    return missing;
  }
}
