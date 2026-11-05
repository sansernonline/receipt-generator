import { MAX_MESSAGE_CHARS } from "@/features/chat/messages";
import { countChars } from "@/features/chat/chat-title";
import { LogContext, logLeak, logged } from "./call-log";
import { OUTPUT_TOKENS, inputBudgetChars, splitForBudget } from "./chunk-text";
import { AiCallError, complete, ocrPage } from "./connector";
import { IMAGE_LIMIT_PER_MINUTE, sharedImageLimiter } from "./image-limiter";
import { hasLeak } from "./leak";
import { refusalMessage } from "./refusals";
import { MESSAGE_AI_UNREACHABLE, MESSAGE_INTERNAL_INFO, MESSAGE_INVALID_REPLY, MESSAGE_TOO_LONG, MESSAGE_TOO_LONG_INPUT, MESSAGE_PARTIAL_OCR, MESSAGE_TOO_MANY_IMAGES, messageWaitForImages } from "./messages";
import {
  DEFAULT_IMAGE_REQUEST, PROMPT_ID, PROMPT_VERSION, SERVER_CANARY,
  bangkokDate, buildRetryMessage, buildSystem, buildUserMessage, fitHistory,
} from "./prompts";
import type { AiLogEntry, AskAiDeps, AskAiInput, AskAiResult, Operation } from "./types";
import { parseReply, type Reply } from "./validate-reply";

export type Ctx = AskAiDeps & LogContext & { canary: string };
export type Failure = Extract<AskAiResult, { ok: false }>;

const MAX_OCR_CHARS = 20_000; // per picture: a longer text is cut, so the number of AI calls stays bounded
const MIN_CHUNK_CHARS = 500; // never split picture text into pieces smaller than this

const defaultLog = (entry: AiLogEntry) => console.info("[ai]", JSON.stringify(entry));
export const failed = (code: Failure["code"], userMessage: string): Failure => ({ ok: false, code, userMessage });

export class LeakDetected extends Error {}

/** Runs one AI task with the shared set-up and turns every way it can break into a failure the user can read. */
export async function withContext<T>(chatId: string, deps: AskAiDeps, task: (ctx: Ctx) => Promise<T>): Promise<T | Failure> {
  const ctx: Ctx = { ...deps, log: deps.log ?? defaultLog, now: deps.now ?? (() => new Date()), canary: deps.canary ?? SERVER_CANARY };
  try {
    return await task(ctx);
  } catch (error) {
    if (error instanceof AiCallError) return failed("ai_unreachable", MESSAGE_AI_UNREACHABLE);
    if (error instanceof LeakDetected) return failed("leak", MESSAGE_INTERNAL_INFO);
    // Anything else is our own bug: say nothing about it to the user, log only that it happened
    ctx.log({ at: ctx.now().toISOString(), event: "error", chatId });
    return failed("ai_unreachable", MESSAGE_AI_UNREACHABLE);
  }
}

/**
 * Turns a user message (and pictures) into operations for the draft. The draft is never touched here:
 * on any failure the caller simply keeps it as it is.
 */
export const askAi = (input: AskAiInput, deps: AskAiDeps): Promise<AskAiResult> => withContext(input?.chatId, deps, (ctx) => run(input, ctx));

async function run(input: AskAiInput, ctx: Ctx): Promise<AskAiResult> {
  // The chat route checks this too; kept here so no caller can reach the AI with a longer text (FR-AI-080)
  if (countChars(input.userText) > MAX_MESSAGE_CHARS) return failed("message_too_long", MESSAGE_TOO_LONG);
  const refusedImages = checkImageLimit(input, ctx);
  if (refusedImages) return refusedImages;

  const system = buildSystem(ctx.canary);
  const { messages, isPartial } = await userMessagesFor(input, ctx, system);
  if (messages.length > ctx.config.maxChunks) return failed("too_long_input", MESSAGE_TOO_LONG_INPUT);

  const replies: Reply[] = [];
  for (const user of messages) {
    const reply = await readCommand(input, ctx, system, user);
    if (!reply) return failed("invalid_reply", MESSAGE_INVALID_REPLY);
    if (reply.status === "refuse") return failed("refused", refusalMessage(reply.reason, reply.action));
    replies.push(reply);
  }
  return joinReplies(replies, isPartial);
}

/** Counts the pictures of this message against the per-minute limit before any OCR call (FR-AI-090 · 120). */
function checkImageLimit(input: AskAiInput, deps: Ctx): Failure | null {
  const count = input.images?.length ?? 0;
  if (count === 0) return null;
  if (count > IMAGE_LIMIT_PER_MINUTE) return failed("rate_limited", MESSAGE_TOO_MANY_IMAGES);
  const taken = (deps.imageLimiter ?? sharedImageLimiter).take(count);
  return taken.ok ? null : failed("rate_limited", messageWaitForImages(taken.waitSeconds));
}

/** One message without pictures; with pictures, one per piece of text that fits the token budget. */
async function userMessagesFor(input: AskAiInput, ctx: Ctx, system: string): Promise<{ messages: string[]; isPartial: boolean }> {
  const base = { today: bangkokDate(ctx.now()), draft: input.draft };
  const fixedChars = system.length + JSON.stringify(input.draft).length + input.userText.length;
  const budget = inputBudgetChars(ctx.config, fixedChars);

  if (!input.images?.length) {
    const history = fitHistory(input.chatHistory ?? [], budget);
    return { messages: [buildUserMessage({ ...base, history, userText: input.userText })], isPartial: false };
  }
  // simple: a picture request is self-contained, so no history goes with it (P-003 does not use it either)
  const texts = await readPictures(input, ctx);
  const pieces = texts.flatMap((text) => splitForBudget(text.slice(0, MAX_OCR_CHARS), Math.max(budget, MIN_CHUNK_CHARS)));
  // the user's own words go with the first piece only; the others would repeat up to 10,000 characters each
  const messages = pieces.map((ocrText, i) =>
    buildUserMessage({ ...base, history: [], ocrText, userText: i === 0 ? input.userText || DEFAULT_IMAGE_REQUEST : DEFAULT_IMAGE_REQUEST }),
  );
  return { messages, isPartial: texts.some((t) => t.length > MAX_OCR_CHARS) };
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

function joinReplies(replies: Reply[], isPartial: boolean): AskAiResult {
  const operations: Operation[] = replies.flatMap((r) => r.operations);
  const text = [...replies.map((r) => (r.status === "clarify" ? r.question : r.reply)), ...(isPartial ? [MESSAGE_PARTIAL_OCR] : [])].join(" ");
  return { ok: true, operations, reply: text };
}
