import path from "node:path";
import type { Store } from "@/features/storage/store";
import { parseDraft } from "./parse-draft";
import type { Draft } from "./types";

const MAX_UNDO = 10; // FR-ITEM-120: at least the last 10 edits; the file keeps exactly 10 (ARCH 4.1 undo.json)

const undoFile = (store: Store, chatId: string) => path.join(store.chatDir(chatId), "undo.json");

/** The drafts before the last edits, oldest first. A missing or damaged file means nothing to undo. */
export async function readUndo(store: Store, chatId: string): Promise<Draft[]> {
  const raw = await store.readJson<unknown>(undoFile(store, chatId)).catch(() => null);
  return Array.isArray(raw) ? raw.slice(-MAX_UNDO).map(parseDraft) : [];
}

/** Call inside withChatLock, before the edited draft is written. */
export async function pushUndo(store: Store, chatId: string, before: Draft): Promise<void> {
  const kept = [...(await readUndo(store, chatId)), before].slice(-MAX_UNDO);
  await store.writeJsonAtomic(undoFile(store, chatId), kept);
}

/** Puts the draft back to before the last edit; null when there is none. Totals are not stored, they are calculated from the returned draft. */
export function undoLastEdit(store: Store, chatId: string): Promise<Draft | null> {
  return store.withChatLock(chatId, async () => {
    const stack = await readUndo(store, chatId);
    const previous = stack.pop();
    if (!previous) return null;
    await store.writeJsonAtomic(path.join(store.chatDir(chatId), "draft.json"), previous); // draft first: a stop in between only costs one extra undo to the same draft
    await store.writeJsonAtomic(undoFile(store, chatId), stack);
    return previous;
  });
}
