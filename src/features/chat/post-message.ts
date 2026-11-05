import type { SendMessageResponse } from "@/features/draft/types";

// 5 s more than the server's own AI limit (60 s, ai/config.ts) so the server's "AI unreachable, draft unchanged" notice arrives first (FR-CHAT-130)
// must stay above AI_TIMEOUT_MS in ai/config.ts: if that value is raised, raise this one too (not linked on purpose)
export const AI_WAIT_LIMIT_MS = 65_000;
export class AiWaitTimeout extends Error {}

/** Posts one request that waits for the AI and gives up after the wait limit so the box can never stay closed for good. */
async function postAndWait(url: string, init: RequestInit): Promise<SendMessageResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_WAIT_LIMIT_MS);
  try {
    const res = await fetch(url, { method: "POST", ...init, signal: controller.signal });
    if (!res.ok) throw new Error("send failed");
    return await res.json();
  } catch (error) {
    throw controller.signal.aborted ? new AiWaitTimeout() : error;
  } finally {
    clearTimeout(timer);
  }
}

export const postMessage = (chatId: string, text: string) =>
  postAndWait(`/api/chats/${chatId}/messages`, { headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });

/** The sample bill picture. The browser sets the form's content type itself. */
export function postPicture(chatId: string, file: File) {
  const form = new FormData();
  form.set("image", file);
  return postAndWait(`/api/chats/${chatId}/shop-image`, { body: form });
}
