import { askShop } from "@/features/ai/ask-shop";
import { loadAiConfig } from "@/features/ai/config";
import { MESSAGE_AI_UNREACHABLE } from "@/features/ai/messages";
import { historyBefore } from "@/features/chat/messages";
import type { Store } from "@/features/storage/store";
import type { ShopFields } from "./types";

export const NOTICE_NO_SHOP_INFO = "ยังไม่มีหัวบิล เริ่มจากพิมพ์ข้อมูลร้านในแชต (ชื่อ ที่อยู่ โทร และชนิดเอกสาร)"; // mockup #s-chat wording

export type ShopTurn = { notices: string[]; card?: ShopFields; hasBillContent?: boolean; error?: string };

/**
 * A message in a chat that has no shop header yet: the AI reads it as shop info (P-002). The proposal is handed back for the user
 * to review; nothing is saved here, so only the user's own button can set a header (ADR-0004 · ADR-0006).
 */
export async function shopTurn(store: Store, chatId: string, userMessage: { text: string; createdAt: string }): Promise<ShopTurn> {
  const config = loadAiConfig();
  // No key = no AI call at all: nothing may leave this machine until the owner has configured one
  if (!config.apiKey) return { notices: [MESSAGE_AI_UNREACHABLE], error: "ai_unreachable" };
  const chatHistory = await historyBefore(store, chatId, userMessage);
  const result = await askShop({ chatId, userText: userMessage.text, chatHistory }, { config });
  if (!result.ok) return { notices: [result.userMessage], error: result.code };
  return result.card ? { notices: [], card: result.card, hasBillContent: result.hasBillContent } : { notices: [NOTICE_NO_SHOP_INFO] };
}
