import { MAX_MESSAGE_CHARS } from "@/features/chat/messages";
import { countChars } from "@/features/chat/chat-title";
import { LogContext, logLeak, logged } from "./call-log";
import { OUTPUT_TOKENS, inputBudgetChars, splitForBudget } from "./chunk-text";
import { AiCallError, complete, ocrPage } from "./connector";
import { hasLeak } from "./leak";
import { refusalMessage } from "./refusals";
import { MESSAGE_AI_UNREACHABLE, MESSAGE_INTERNAL_INFO, MESSAGE_INVALID_REPLY, MESSAGE_TOO_LONG } from "./messages";
import {
  DEFAULT_IMAGE_REQUEST, PROMPT_ID, PROMPT_VERSION, SERVER_CANARY,
  bangkokDate, buildRetryMessage, buildSystem, buildUserMessage, fitHistory,
} from "./prompts";
import type { AiLogEntry, AskAiDeps, AskAiInput, AskAiResult, Operation } from "./types";
import { parseReply, type Reply } from "./validate-reply";

type Ctx = AskAiDeps & LogContext & { canary: string };
type Failure = Extract<AskAiResult, { ok: false }>;

const MAX_OCR_CHARS = 20_000; // per picture: a longer text is cut, so the number of AI calls stays bounded
const MIN_CHUNK_CHARS = 500; // never split picture text into pieces smaller than this

const defaultLog = (entry: AiLogEntry) => console.info("[ai]", JSON.stringify(entry));
const failed = (code: Failure["code"], userMessage: string): Failure => ({ ok: false, code, userMessage });

class LeakDetected extends Error {}

/**
 * Turns a user message (and pictures) into operations for the draft. The draft is never touched here:
 * on any failure the caller simply keeps it as it is.
 */
export async function askAi(input: AskAiInput, deps: AskAiDeps): Promise<AskAiResult> {
  // The chat route checks this too; kept here so no caller can reach the AI with a longer text (FR-AI-080)
  if (countChars(input.userText) > MAX_MESSAGE_CHARS) return failed("message_too_long", MESSAGE_TOO_LONG);
  const ctx: Ctx = { ...deps, log: deps.log ?? defaultLog, now: deps.now ?? (() => new Date()), canary: deps.canary ?? SERVER_CANARY };
  try {
    const system = buildSystem(ctx.canary);
    const replies: Reply[] = [];
    for (const user of await userMessagesFor(input, ctx, system)) {
      const reply = await readCommand(input, ctx, system, user);
      if (!reply) return failed("invalid_reply", MESSAGE_INVALID_REPLY);
      if (reply.status === "refuse") return failed("refused", refusalMessage(reply.reason, reply.action));
      replies.push(reply);
    }
    return joinReplies(replies);
  } catch (error) {
    if (error instanceof AiCallError) return failed("ai_unreachable", MESSAGE_AI_UNREACHABLE);
    if (error instanceof LeakDetected) return failed("leak", MESSAGE_INTERNAL_INFO);
    throw error;
  }
}

/** One message without pictures; with pictures, one per piece of text that fits the token budget. */
async function userMessagesFor(input: AskAiInput, ctx: Ctx, system: string): Promise<string[]> {
  const base = { today: bangkokDate(ctx.now()), draft: input.draft };
  const fixedChars = system.length + JSON.stringify(input.draft).length + input.userText.length;
  const budget = inputBudgetChars(ctx.config, fixedChars);

  if (!input.images?.length) {
    const history = fitHistory(input.chatHistory ?? [], budget);
    return [buildUserMessage({ ...base, history, userText: input.userText })];
  }
  // simple: a picture request is self-contained, so no history goes with it (P-003 does not use it either)
  const userText = input.userText || DEFAULT_IMAGE_REQUEST;
  const texts = await readPictures(input, ctx);
  return texts.flatMap((text) =>
    splitForBudget(text.slice(0, MAX_OCR_CHARS), Math.max(budget, MIN_CHUNK_CHARS)).map((ocrText) => buildUserMessage({ ...base, history: [], ocrText, userText })),
  );
}

async function readPictures(input: AskAiInput, ctx: Ctx): Promise<string[]> {
  const meta = { chatId: input.chatId, promptId: "OCR", model: ctx.config.modelOcr };
  const texts: string[] = [];
  for (const image of input.images ?? []) texts.push(await logged(ctx, meta, () => ocrPage(ctx.config, image, ctx.fetch)));
  return texts;
}

/** First try, then one retry with the problems listed (FR-AI-020). null = both tries failed the check. */
async function readCommand(input: AskAiInput, ctx: Ctx, system: string, user: string): Promise<Reply | null> {
  const first = await attempt(ctx, input, system, user);
  if (first.ok) return first.value;
  const second = await attempt(ctx, input, system, buildRetryMessage(user, first.errors));
  return second.ok ? second.value : null;
}

async function attempt(ctx: Ctx, input: AskAiInput, system: string, user: string) {
  const model = ctx.config.modelText;
  const meta = { chatId: input.chatId, promptId: PROMPT_ID, promptVersion: PROMPT_VERSION, model };
  const messages = [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
  const parsed = await logged(
    ctx, meta,
    async () => parseReply(await complete(ctx.config, { model, maxTokens: OUTPUT_TOKENS, messages }, ctx.fetch), { lineCount: input.draft.items.length }),
    (result) => (result.ok ? "ok" : "schema_fail"),
  );
  if (parsed.ok && hasLeak(parsed.value, { canary: ctx.canary, apiKey: ctx.config.apiKey })) {
    logLeak(ctx, input.chatId);
    throw new LeakDetected();
  }
  return parsed;
}

function joinReplies(replies: Reply[]): AskAiResult {
  const operations: Operation[] = replies.flatMap((r) => r.operations);
  const text = replies.map((r) => (r.status === "clarify" ? r.question : r.reply)).join(" ");
  return { ok: true, operations, reply: text };
}
