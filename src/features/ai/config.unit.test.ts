import { describe, expect, it } from "vitest";
import { loadAiConfig } from "./config";

describe("loadAiConfig", () => {
  it("[TC-AI-009] waits 60 seconds by default", () => {
    expect(loadAiConfig({}).timeoutMs).toBe(60_000);
  });

  it("[TC-NFR-029] takes address and both model names from env only", () => {
    const config = loadAiConfig({ AI_BASE_URL: "http://b/v1/", AI_MODEL_TEXT: "m-text", AI_MODEL_OCR: "m-ocr", AI_API_KEY: "k" });

    expect(config).toMatchObject({ baseUrl: "http://b/v1", modelText: "m-text", modelOcr: "m-ocr", apiKey: "k" });
  });

  it("defaults to the Typhoon address and the 8,192 token ceiling", () => {
    expect(loadAiConfig({})).toMatchObject({ baseUrl: "https://api.opentyphoon.ai/v1", maxTokens: 8192 });
  });

  it("ignores a token ceiling that is not a positive integer", () => {
    expect(loadAiConfig({ AI_MAX_TOKENS: "abc" }).maxTokens).toBe(8192);
  });
});
