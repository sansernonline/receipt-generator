import { SYSTEM_PROMPT_MARKER } from "./prompts";

const MIN_SECRET_LENGTH = 8; // a very short "key" would match ordinary words

// Case, spaces and zero-width characters must not hide a secret
const normalize = (text: string) => text.normalize("NFKC").replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, "").toLowerCase();

/** True when any field of the reply holds the canary, the API key or the start of the system prompt (PROMPT-LIBRARY 2.3 step 5). */
export function hasLeak(reply: unknown, secrets: { canary: string; apiKey: string }): boolean {
  const text = normalize(JSON.stringify(reply));
  const markers = [SYSTEM_PROMPT_MARKER, secrets.canary, secrets.apiKey].map(normalize).filter((m) => m.length >= MIN_SECRET_LENGTH);
  return markers.some((marker) => text.includes(marker));
}
