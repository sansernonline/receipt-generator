import type { AiConfig } from "./types";

const DEFAULT_BASE_URL = "https://api.opentyphoon.ai/v1";
const DEFAULT_MODEL_TEXT = "typhoon-v2.5-30b-a3b-instruct";
const DEFAULT_MODEL_OCR = "typhoon-ocr";
const DEFAULT_MAX_TOKENS = 8192; // ARCH R-03 ceiling, not measured (no real key yet)
const DEFAULT_TIMEOUT_MS = 60_000; // IF-AI-010

function positiveInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// Changing provider = changing these env values only (NFR-MNT-010)
export function loadAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  return {
    baseUrl: (env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: env.AI_API_KEY ?? "",
    modelText: env.AI_MODEL_TEXT || DEFAULT_MODEL_TEXT,
    modelOcr: env.AI_MODEL_OCR || DEFAULT_MODEL_OCR,
    maxTokens: positiveInt(env.AI_MAX_TOKENS, DEFAULT_MAX_TOKENS),
    timeoutMs: positiveInt(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}
