import { randomUUID } from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";

export type FileOps = Pick<typeof fsp, "readFile" | "open" | "rename" | "rm" | "mkdir" | "readdir">;

const RETRY_CODES = new Set(["EPERM", "EBUSY"]);
const RENAME_ATTEMPTS = 3;
const RETRY_WAIT_MS = 25;

// Windows can briefly lock the target (antivirus, indexer); retry rename a few times only
async function renameWithRetry(ops: FileOps, from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ops.rename(from, to);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      if (attempt >= RENAME_ATTEMPTS || !RETRY_CODES.has(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
    }
  }
}

// fsync before rename so a power cut cannot leave a renamed but empty file
async function writeAndSync(ops: FileOps, file: string, text: string): Promise<void> {
  const handle = await ops.open(file, "w");
  try {
    await handle.writeFile(text, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

// temp file in the same folder, then rename: the real file is always whole old or whole new (NFR-REL-010)
export async function writeJsonAtomic(ops: FileOps, file: string, data: unknown): Promise<void> {
  await ops.mkdir(path.dirname(file), { recursive: true });
  const tempFile = `${file}.${randomUUID()}.tmp`;
  try {
    await writeAndSync(ops, tempFile, JSON.stringify(data, null, 2));
    await renameWithRetry(ops, tempFile, file);
  } catch (error) {
    await ops.rm(tempFile, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readJson<T>(ops: FileOps, file: string): Promise<T> {
  return JSON.parse(await ops.readFile(file, "utf8")) as T;
}
