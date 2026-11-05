import type { AiConfig } from "./types";

// What failed, never why in detail: status text, body and address stay out of anything a user can see.
export type AiFailure = "timeout" | "rate_limited" | "server_error" | "network_error" | "bad_response";

export class AiCallError extends Error {
  constructor(readonly failure: AiFailure) {
    super(failure);
  }
}

export type ChatMessage = { role: "system" | "user"; content: string | unknown[] };
export type CompletionRequest = { model: string; messages: ChatMessage[]; maxTokens: number };

const MAX_RESPONSE_BYTES = 1_000_000; // a bigger answer is not a chat reply

/** One OpenAI-style chat completion. Returns the text of the first choice. */
export async function complete(config: AiConfig, request: CompletionRequest, fetchFn: typeof fetch = fetch): Promise<string> {
  const response = await send(config, request, fetchFn);
  if (response.status === 429) throw new AiCallError("rate_limited");
  if (!response.ok) throw new AiCallError("server_error");
  return contentOf(await readBounded(response));
}

async function send(config: AiConfig, request: CompletionRequest, fetchFn: typeof fetch) {
  try {
    return await fetchFn(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: request.model, messages: request.messages, temperature: 0, max_tokens: request.maxTokens }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw toCallError(error);
  }
}

async function readBounded(response: Response): Promise<string> {
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new AiCallError("bad_response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (let part = await reader.read(); !part.done; part = await reader.read()) {
      size += part.value.length;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new AiCallError("bad_response");
      }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    throw toCallError(error);
  }
}

function contentOf(body: string): string {
  try {
    const content = JSON.parse(body)?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
  } catch {
    // falls through to the same error as a missing content field
  }
  throw new AiCallError("bad_response");
}

function toCallError(error: unknown): AiCallError {
  if (error instanceof AiCallError) return error;
  const name = (error as { name?: string })?.name;
  return new AiCallError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error");
}
