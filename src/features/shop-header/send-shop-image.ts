import { askShopImage } from "@/features/ai/ask-shop-image";
import { loadAiConfig } from "@/features/ai/config";
import { MESSAGE_AI_UNREACHABLE } from "@/features/ai/messages";
import type { AskAiDeps } from "@/features/ai/types";
import { addUserMessage } from "@/features/chat/messages";
import { openDraft } from "@/features/draft/open-draft";
import type { SendMessageResponse } from "@/features/draft/types";
import type { Store } from "@/features/storage/store";
import { saveOriginalImage } from "@/features/uploads/original-image";

export const IMAGE_MESSAGE_TEXT = "ส่งรูปบิลตัวอย่าง"; // the client's file name is never stored in the chat
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export type ShopImageInput = { bytes: Uint8Array };

/**
 * A sample bill picture in a chat with no shop header yet: keep the original with the chat (FR-HDR-150), read it (OCR then P-001)
 * and answer with a card to review. Nothing is saved as the shop: only the user's "ใช้หัวบิลนี้" does that (ADR-0006).
 * The bytes are the route's checked upload.
 */
export async function sendShopImage(store: Store, chatId: string, { bytes }: ShopImageInput, deps: Partial<AskAiDeps> = {}): Promise<SendMessageResponse> {
  const { chat, message } = await addUserMessage(store, chatId, IMAGE_MESSAGE_TEXT);
  const { type } = await saveOriginalImage(store, chatId, bytes);
  const config = loadAiConfig();
  // No key = no AI call at all: nothing may leave this machine until the owner has configured one
  const turn = config.apiKey
    ? await askShopImage({ chatId, image: { mimeType: MIME[type], data: bytes } }, { config, ...deps })
    : ({ ok: false, code: "ai_unreachable", userMessage: MESSAGE_AI_UNREACHABLE } as const);
  return {
    chat, message, messages: [message], ...(await openDraft(store, chatId)),
    notices: turn.ok ? [] : [turn.userMessage],
    ...(turn.ok ? { shopCard: turn.card } : { error: turn.code }),
  };
}
