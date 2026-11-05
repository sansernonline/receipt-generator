import { afterEach, beforeEach } from "vitest";
import { type AiStub, reply, startAiStub } from "../../../test/ai-stub/ai-stub";
import { askAi } from "./ask-ai";
import { createImageLimiter } from "./image-limiter";
import type { AiConfig, AiLogEntry, AskAiDeps, AskAiInput } from "./types";

// Shared set-up for the tests that talk to the fake AI service.
export const KEY = "TESTKEY-0123456789";
export const CANARY = "7fQ2kL9xPa3mZ8wD";
export const draft = { items: [{ line: 1, name: "กาแฟเย็น" }, { line: 2, name: "ชาเย็น" }] };
export const addWater = { op: "add_item", name: "น้ำเปล่า", qty: 1, unit: "ขวด", unit_price: 10, code: null, description: null };

export const input = (userText = "เพิ่มน้ำเปล่า 1 ขวด 10", over: Partial<AskAiInput> = {}): AskAiInput => ({ chatId: "chat-1", userText, draft, ...over });
export const okBody = (over: Record<string, unknown> = {}) => ({ status: "ok", reason: null, action: null, operations: [addWater], question: null, reply: "เพิ่มน้ำเปล่าแล้ว", ...over });
export const okReply = (over: Record<string, unknown> = {}) => reply(okBody(over));
export const refuseReply = (reason: string, over: Record<string, unknown> = {}) =>
  reply({ status: "refuse", reason, action: null, operations: [], question: null, reply: null, ...over });

export function useAiStub() {
  const state = {} as { stub: AiStub; logs: AiLogEntry[] };
  beforeEach(async () => {
    state.stub = await startAiStub();
    state.logs = [];
  });
  afterEach(() => state.stub.close());

  const configFor = (over: Partial<AiConfig> = {}): AiConfig => ({
    baseUrl: state.stub.baseUrl, apiKey: KEY, modelText: "m-text", modelOcr: "typhoon-ocr", maxTokens: 8192, timeoutMs: 60_000, maxChunks: 5, ...over,
  });
  const ask = (i: AskAiInput = input(), deps: Partial<AskAiDeps> = {}) =>
    askAi(i, { config: configFor(), log: (e) => state.logs.push(e), canary: CANARY, imageLimiter: createImageLimiter(), ...deps });
  return { state, configFor, ask };
}
