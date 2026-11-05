import { OUTPUT_TOKENS } from "./chunk-text";
import { AiCallError, complete } from "./connector";
import { MESSAGE_AI_UNREACHABLE, MESSAGE_INVALID_REPLY, MESSAGE_REFUSED } from "./messages";
import { PROMPT_ID, PROMPT_VERSION, bangkokDate, buildRetryMessage, buildSystem, buildUserMessage } from "./prompts";
import type { AiLogEntry, AskAiDeps, AskAiInput, AskAiResult } from "./types";
import { parseReply, type Reply } from "./validate-reply";

type Ctx = AskAiDeps & Required<Pick<AskAiDeps, "log" | "now">>;

const defaultLog = (entry: AiLogEntry) => console.info("[ai]", JSON.stringify(entry));
const failed = (code: Extract<AskAiResult, { ok: false }>["code"], userMessage: string): AskAiResult => ({ ok: false, code, userMessage });

/**
 * Turns a user message into operations for the draft. The draft is never touched here:
 * on any failure the caller simply keeps it as it is.
 */
export async function askAi(input: AskAiInput, deps: AskAiDeps): Promise<AskAiResult> {
  const ctx: Ctx = { ...deps, log: deps.log ?? defaultLog, now: deps.now ?? (() => new Date()) };
  try {
    const reply = await readCommand(input, ctx);
    return reply ? toResult(reply) : failed("invalid_reply", MESSAGE_INVALID_REPLY);
  } catch (error) {
    if (error instanceof AiCallError) return failed("ai_unreachable", MESSAGE_AI_UNREACHABLE);
    throw error;
  }
}

/** First try, then one retry with the problems listed (FR-AI-020). null = both tries failed the check. */
async function readCommand(input: AskAiInput, ctx: Ctx): Promise<Reply | null> {
  const system = buildSystem(ctx.canary ?? "");
  const user = buildUserMessage({ today: bangkokDate(ctx.now()), draft: input.draft, userText: input.userText });
  const first = await attempt(ctx, input, system, user);
  if (first.ok) return first.value;
  const second = await attempt(ctx, input, system, buildRetryMessage(user, first.errors));
  return second.ok ? second.value : null;
}

async function attempt(ctx: Ctx, input: AskAiInput, system: string, user: string) {
  const model = ctx.config.modelText;
  const started = Date.now();
  const log = (outcome: AiLogEntry["outcome"]) =>
    ctx.log({ at: ctx.now().toISOString(), event: "call", chatId: input.chatId, promptId: PROMPT_ID, promptVersion: PROMPT_VERSION, model, durationMs: Date.now() - started, outcome });
  try {
    const messages = [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
    const raw = await complete(ctx.config, { model, maxTokens: OUTPUT_TOKENS, messages }, ctx.fetch);
    const parsed = parseReply(raw, { lineCount: input.draft.items.length });
    log(parsed.ok ? "ok" : "schema_fail");
    return parsed;
  } catch (error) {
    if (error instanceof AiCallError) log(error.failure);
    throw error;
  }
}

function toResult(reply: Reply): AskAiResult {
  if (reply.status === "ok") return { ok: true, operations: reply.operations, reply: reply.reply as string };
  if (reply.status === "clarify") return { ok: true, operations: [], reply: reply.question as string };
  return failed("refused", MESSAGE_REFUSED);
}
