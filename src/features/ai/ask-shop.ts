import { countChars } from "@/features/chat/chat-title";
import { MAX_MESSAGE_CHARS } from "@/features/chat/messages";
import type { ShopFields } from "@/features/shop-header/types";
import { logLeak, logged } from "./call-log";
import { inputBudgetChars } from "./chunk-text";
import { complete } from "./connector";
import { hasLeak } from "./leak";
import { MESSAGE_INVALID_REPLY, MESSAGE_TOO_LONG } from "./messages";
import { type Ctx, type Failure, LeakDetected, failed, withContext } from "./ask-ai";
import { buildRetryMessage, buildShopMessage, fitHistory } from "./prompts";
import { P005_GUARD } from "./prompt-texts";
import { refusalMessage } from "./refusals";
import { P002_SYSTEM } from "./shop-prompt-texts";
import type { AskAiDeps, ChatTurn } from "./types";
import { type ShopReply, type ShopReplyHeader, parseShopReply } from "./validate-shop-reply";

const PROMPT_ID = "P-002";
const PROMPT_VERSION = "0.3";
const OUTPUT_TOKENS = 1024; // PROMPT-LIBRARY P-002 (รอยืนยัน)

export type AskShopInput = { chatId: string; userText: string; chatHistory?: ChatTurn[] };

/** card = what the user may review; null = the message holds no shop info. hasBillContent = the message also has a customer or items. The chat is never touched here (FR-HDR-100). */
export type AskShopResult = { ok: true; card: ShopFields | null; hasBillContent: boolean } | Failure;

const TEMPLATE_OF = { cash_bill: "cash", receipt: "receipt", tax_invoice_receipt: "taxinv", invoice: "invoice" } as const;

function toCard(header: ShopReplyHeader): ShopFields | null {
  const { shop_name, address, tax_id, phone, email, doc_type } = header;
  if ([shop_name, address, tax_id, phone, email, doc_type].every((value) => value === null)) return null;
  // no document type given: the card starts on "ใบเสร็จรับเงิน" and the user picks (PROMPT-LIBRARY P-002)
  return { shopName: shop_name ?? "", address: address ?? "", taxId: tax_id ?? "", phone: phone ?? "", email: email ?? "", template: doc_type ? TEMPLATE_OF[doc_type] : "receipt" };
}

export const askShop = (input: AskShopInput, deps: AskAiDeps): Promise<AskShopResult> => withContext(input.chatId, deps, (ctx) => run(input, ctx));

async function run(input: AskShopInput, ctx: Ctx): Promise<AskShopResult> {
  if (countChars(input.userText) > MAX_MESSAGE_CHARS) return failed("message_too_long", MESSAGE_TOO_LONG);
  const system = P002_SYSTEM.replace("{{GUARD}}", P005_GUARD.replace("{{canary}}", ctx.canary));
  const history = fitHistory(input.chatHistory ?? [], inputBudgetChars(ctx.config, system.length + input.userText.length));
  const user = buildShopMessage(history, input.userText);

  const reply = await readShop(input.chatId, ctx, system, user);
  if (!reply) return failed("invalid_reply", MESSAGE_INVALID_REPLY);
  if (reply.status === "refuse") return failed("refused", refusalMessage(reply.reason, null));
  return { ok: true, card: reply.header && toCard(reply.header), hasBillContent: reply.has_bill_content };
}

/** First try, then one retry with the problems listed (FR-AI-020). null = both tries failed the check. */
async function readShop(chatId: string, ctx: Ctx, system: string, user: string): Promise<ShopReply | null> {
  const first = await attempt(chatId, ctx, system, user);
  if (first.ok) return first.value;
  const second = await attempt(chatId, ctx, system, buildRetryMessage(user, first.errors));
  return second.ok ? second.value : null;
}

async function attempt(chatId: string, ctx: Ctx, system: string, user: string) {
  const model = ctx.config.modelText;
  const meta = { chatId, promptId: PROMPT_ID, promptVersion: PROMPT_VERSION, model };
  const messages = [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
  const parsed = await logged(ctx, meta, async () => parseShopReply(await complete(ctx.config, { model, maxTokens: OUTPUT_TOKENS, messages }, ctx.fetch)), (result) => (result.ok ? "ok" : "schema_fail"));
  if (parsed.ok && hasLeak(parsed.value, { canary: ctx.canary, apiKey: ctx.config.apiKey })) {
    logLeak(ctx, chatId);
    throw new LeakDetected();
  }
  return parsed;
}
