import type { SendMessageResponse } from "@/features/draft/types";

// 5 s more than the server's own AI limit (60 s, ai/config.ts) so the server's "AI unreachable, draft unchanged" notice arrives first (FR-CHAT-130)
// must stay above AI_TIMEOUT_MS in ai/config.ts: if that value is raised, raise this one too (not linked on purpose)
export const AI_WAIT_LIMIT_MS = 65_000;
export class AiWaitTimeout extends Error {}

/** Posts one message and gives up after the wait limit so the box can never stay closed for good. */
export async function postMessage(chatId: string, text: string): Promise<SendMessageResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_WAIT_LIMIT_MS);
  try {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("send failed");
    return await res.json();
  } catch (error) {
    throw controller.signal.aborted ? new AiWaitTimeout() : error;
  } finally {
    clearTimeout(timer);
  }
}
