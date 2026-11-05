import path from "node:path";
import { askAi } from "@/features/ai/ask-ai";
import { loadAiConfig } from "@/features/ai/config";
import { MESSAGE_AI_UNREACHABLE } from "@/features/ai/messages";
import type { AskAiResult } from "@/features/ai/types";
import { addUserMessage } from "@/features/chat/messages";
import type { Store } from "@/features/storage/store";
import { toAiDraft } from "./ai-draft";
import { applyOperations, usesLineNumbers } from "./apply-operations";
import { totalsOf } from "./draft-totals";
import { netNotices } from "./net-notices";
import { NOTICE_DRAFT_CHANGED, NOTICE_SAVE_FAILED } from "./notices";
import { parseDraft } from "./parse-draft";
import type { Draft, SendMessageResponse, StoredMessage } from "./types";

type StoredChat = { id: string; title: string; updatedAt: string; shopId: string | null; billNumber: string | null; customerName: string | null; messages: StoredMessage[] };
type Turn = Pick<SendMessageResponse, "messages" | "notices"> & { draft: Draft };

const files = (store: Store, chatId: string) => ({ chat: path.join(store.chatDir(chatId), "chat.json"), draft: path.join(store.chatDir(chatId), "draft.json") });

export async function readDraft(store: Store, chatId: string): Promise<Draft> {
  return parseDraft(await store.readJson<unknown>(files(store, chatId).draft));
}

// No key = no AI call at all: nothing may leave this machine until the owner has configured one
async function askAboutDraft(store: Store, chatId: string, userMessage: StoredMessage, draft: Draft): Promise<AskAiResult> {
  const config = loadAiConfig();
  if (!config.apiKey) return { ok: false, code: "ai_unreachable", userMessage: MESSAGE_AI_UNREACHABLE };
  const chat = await store.readJson<StoredChat>(files(store, chatId).chat);
  const chatHistory = chat.messages.filter((m) => !(m.createdAt === userMessage.createdAt && m.text === userMessage.text));
  return askAi({ chatId, userText: userMessage.text, draft: toAiDraft(draft), chatHistory }, { config });
}

/**
 * Applies the AI answer to the CURRENT draft (read again inside the lock, so two messages sent together both land)
 * and overwrites draft.json: one draft per chat, no version is made here (FR-DOC-020).
 */
function saveAnswer(store: Store, chatId: string, result: AskAiResult, shown: string): Promise<Turn> {
  return store.withChatLock(chatId, async () => {
    const draft = await readDraft(store, chatId);
    if (!result.ok) return { draft, messages: [], notices: [result.userMessage] };

    // "line" numbers mean the draft the AI was shown; if another message changed it meanwhile they may point at another line
    if (JSON.stringify(draft) !== shown && usesLineNumbers(result.operations)) return { draft, messages: [], notices: [NOTICE_DRAFT_CHANGED] };

    const applied = applyOperations(draft, result.operations);
    if (!applied.isApplied) return { draft, messages: [], notices: applied.notices };

    const reply: StoredMessage = { role: "assistant", text: result.reply, createdAt: new Date().toISOString() };
    const chatFile = files(store, chatId).chat;
    const chat = await store.readJson<StoredChat>(chatFile);
    const updated = { ...chat, updatedAt: reply.createdAt, messages: [...chat.messages, reply] };
    if (result.operations.length > 0) await store.writeJsonAtomic(files(store, chatId).draft, applied.draft);
    await store.writeJsonAtomic(chatFile, updated);
    await store.upsertIndex(updated);
    return { draft: applied.draft, messages: [reply], notices: netNotices(draft, applied.draft) };
  });
}

/** One user message: store it, ask the AI, apply the operations, answer with the draft and totals the server computed. */
export async function sendMessage(store: Store, chatId: string, text: string): Promise<SendMessageResponse> {
  const { chat, message } = await addUserMessage(store, chatId, text);
  const shown = await readDraft(store, chatId);
  const result = await askAboutDraft(store, chatId, message, shown);
  const turn = await saveAnswer(store, chatId, result, JSON.stringify(shown)).catch(async (): Promise<Turn> => ({
    draft: await readDraft(store, chatId).catch(() => parseDraft(null)), messages: [], notices: [NOTICE_SAVE_FAILED],
  }));
  const updatedAt = turn.messages.at(-1)?.createdAt ?? chat.updatedAt;
  return {
    chat: { ...chat, updatedAt }, message, messages: [message, ...turn.messages], draft: turn.draft, totals: totalsOf(turn.draft),
    notices: turn.notices, ...(result.ok ? {} : { error: result.code }),
  };
}
