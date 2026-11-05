import path from "node:path";
import { withLock } from "@/features/storage/lock";
import type { Store } from "@/features/storage/store";

type Entry = { at: string };

async function readLog(store: Store, file: string): Promise<Entry[]> {
  try {
    return await store.readJson<Entry[]>(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; // nobody has accepted yet
    throw error; // a damaged log must not be overwritten with a shorter one
  }
}

// One entry per click, only the time: no name and no customer data (NFR-PDPA-040)
export function recordConsent(store: Store, now: Date = new Date()): Promise<void> {
  const file = path.join(store.dir, "consent-log.json");
  return withLock(`consent:${store.dir}`, async () => {
    const log = await readLog(store, file);
    await store.writeJsonAtomic(file, [...log, { at: now.toISOString() }]);
  });
}
