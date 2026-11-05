import type { AiConfig } from "./types";

export const OUTPUT_TOKENS = 2048; // P-004 max_tokens: answer space inside the shared ceiling
const CHARS_PER_TOKEN = 2; // simple: pessimistic for Thai, not measured (ARCH R-03); raise once the real ratio is known

/** How many characters of data fit next to the fixed prompt (system prompt, draft, history). */
export function inputBudgetChars(config: Pick<AiConfig, "maxTokens">, fixedChars: number): number {
  const total = (config.maxTokens - OUTPUT_TOKENS) * CHARS_PER_TOKEN;
  return Math.max(0, total - fixedChars);
}

/** Splits at line breaks so no line is torn; a line longer than the budget is cut. */
export function splitForBudget(text: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    for (const part of cutLong(line, maxChars)) {
      if (current && current.length + 1 + part.length > maxChars) {
        pieces.push(current);
        current = "";
      }
      current = current ? `${current}\n${part}` : part;
    }
  }
  if (current.trim()) pieces.push(current);
  return pieces;
}

function cutLong(line: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += maxChars) parts.push(line.slice(i, i + maxChars));
  return parts.length ? parts : [""];
}
