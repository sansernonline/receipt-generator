import { SYSTEM_PROMPT_MARKER } from "./prompts";
import type { Reply } from "./validate-reply";

const MIN_SECRET_LENGTH = 8; // a very short "key" would match ordinary words

/** True when any field of the reply holds the canary, the API key or the start of the system prompt (PROMPT-LIBRARY 2.3 step 5). */
export function hasLeak(reply: Reply, secrets: { canary: string; apiKey: string }): boolean {
  const text = JSON.stringify(reply);
  const markers = [SYSTEM_PROMPT_MARKER, secrets.canary, secrets.apiKey].filter((m) => m.length >= MIN_SECRET_LENGTH);
  return markers.some((marker) => text.includes(marker));
}
