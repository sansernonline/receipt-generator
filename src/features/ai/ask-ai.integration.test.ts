import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AiStub, reply, startAiStub } from "../../../test/ai-stub/ai-stub";
import { askAi } from "./ask-ai";
import type { AiConfig, AiLogEntry, AskAiInput } from "./types";

const KEY = "TESTKEY-0123456789";
const draft = { items: [{ line: 1, name: "กาแฟเย็น" }, { line: 2, name: "ชาเย็น" }] };
const input = (userText = "เพิ่มน้ำเปล่า 1 ขวด 10"): AskAiInput => ({ chatId: "chat-1", userText, draft });
const addWater = { op: "add_item", name: "น้ำเปล่า", qty: 1, unit: "ขวด", unit_price: 10, code: null, description: null };
const okBody = (over: Record<string, unknown> = {}) => ({ status: "ok", reason: null, action: null, operations: [addWater], question: null, reply: "เพิ่มน้ำเปล่าแล้ว", ...over });
const invalid = reply(okBody({ operations: [{ ...addWater, qty: "สาม" }] }));
const RETRY_HEADING = "ผลครั้งก่อนไม่ผ่านการตรวจรูปแบบ";

let stub: AiStub;
let logs: AiLogEntry[];
const configFor = (over: Partial<AiConfig> = {}): AiConfig => ({ baseUrl: stub.baseUrl, apiKey: KEY, modelText: "m-text", modelOcr: "typhoon-ocr", maxTokens: 8192, timeoutMs: 60_000, ...over });
const ask = (i: AskAiInput = input(), config = configFor()) => askAi(i, { config, log: (e) => logs.push(e) });

beforeEach(async () => {
  stub = await startAiStub();
  logs = [];
});
afterEach(() => stub.close());

describe("askAi: validate, retry once, keep the draft", () => {
  it("[TC-AI-002][TC-AI-006] uses a correct reply and calls the AI once", async () => {
    stub.script("text", reply(okBody()));

    const result = await ask();

    expect(result).toEqual({ ok: true, operations: [addWater], reply: "เพิ่มน้ำเปล่าแล้ว" });
    expect(stub.count("text")).toBe(1);
  });

  it("[TC-AI-001][TC-AI-030] a quantity written as text never gets through; user is told to retype", async () => {
    stub.script("text", invalid);

    const result = await ask();

    expect(result).toEqual({ ok: false, code: "invalid_reply", userMessage: "ยังอ่านคำสั่งไม่ได้ ลองพิมพ์ใหม่" });
  });

  it("[TC-AI-004] a batch with a bad later operation applies nothing", async () => {
    stub.script("text", reply(okBody({ operations: [addWater, { op: "remove_item", line: 99 }] })));

    expect(await ask()).toMatchObject({ ok: false, code: "invalid_reply" });
  });

  it("[TC-AI-005] invalid first, valid second: 2 calls, the second result is used, the bad output is not sent back", async () => {
    stub.script("text", reply("SECRET-RAW-OUTPUT {oops"), reply(okBody()));

    const result = await ask();

    expect(result).toMatchObject({ ok: true });
    expect(stub.count("text")).toBe(2);
    const retryUser = stub.requests[1].body.messages.at(-1).content as string;
    expect(retryUser).toContain(RETRY_HEADING);
    expect(retryUser).not.toContain("SECRET-RAW-OUTPUT");
  });

  it("[TC-AI-007] invalid twice: exactly 2 calls, no third", async () => {
    stub.script("text", invalid);

    await ask();

    expect(stub.count("text")).toBe(2);
  });

  it("[TC-AI-031] the user message never carries the raw AI output", async () => {
    stub.script("text", reply("SECRET-RAW-OUTPUT"));

    const result = await ask();

    expect(JSON.stringify(result)).not.toContain("SECRET-RAW-OUTPUT");
  });

  it("[TC-AI-010] 429, 500 and a dropped connection give one Thai message with no status code or AI content", async () => {
    for (const behavior of [{ status: 429, body: "rate limit 429" }, { status: 500, body: "boom 500" }, { drop: true as const }]) {
      stub.script("text", behavior);

      const result = await ask();

      expect(result).toMatchObject({ ok: false, code: "ai_unreachable" });
      expect(JSON.stringify(result)).not.toMatch(/429|500|boom|rate limit/);
    }
  });

  it("[TC-AI-021] an error body holding the key and the AI address is not shown to the user", async () => {
    stub.script("text", { status: 500, body: `key ${KEY} at https://api.opentyphoon.ai/v1` });

    const text = JSON.stringify(await ask());

    expect(text).not.toContain(KEY);
    expect(text).not.toContain("opentyphoon");
  });

  it("[TC-AI-008] no answer within the wait time: unreachable message (scaled: 150 ms stands for 60 s)", async () => {
    stub.script("text", { hang: true });

    const result = await ask(input(), configFor({ timeoutMs: 150 }));

    expect(result).toMatchObject({ ok: false, code: "ai_unreachable" });
  });

  it("[TC-AI-009] an answer just inside the wait time is used, one after it is not (scaled 300 ms)", async () => {
    stub.script("text", { ...reply(okBody()), delayMs: 150 });
    expect(await ask(input(), configFor({ timeoutMs: 600 }))).toMatchObject({ ok: true });

    stub.script("text", { ...reply(okBody()), delayMs: 900 });
    expect(await ask(input(), configFor({ timeoutMs: 600 }))).toMatchObject({ ok: false, code: "ai_unreachable" });
  });

  it("a clarify answer comes back as the question with no operations", async () => {
    stub.script("text", reply(okBody({ status: "clarify", operations: [], question: "หมายถึงบรรทัดไหน", reply: null })));

    expect(await ask()).toEqual({ ok: true, operations: [], reply: "หมายถึงบรรทัดไหน" });
  });
});

describe("askAi: request shape and call log", () => {
  it("sends the system prompt and the user data as separate messages, temperature 0, no response_format, key in the header", async () => {
    stub.script("text", reply(okBody()));

    await ask();

    const { body, authorization } = stub.requests[0];
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(body).toMatchObject({ model: "m-text", temperature: 0, max_tokens: 2048 });
    expect(body).not.toHaveProperty("response_format");
    expect(authorization).toBe(`Bearer ${KEY}`);
  });

  it("[TC-NFR-028] the log has one row per AI call, retries and failures included, and never the key", async () => {
    stub.script("text", invalid, reply(okBody()));
    await ask();
    stub.script("text", { status: 500 });
    await ask();

    const calls = logs.filter((l) => l.event === "call");
    expect(calls).toHaveLength(stub.count("text"));
    expect(calls.map((c) => c.outcome)).toEqual(["schema_fail", "ok", "server_error"]);
    expect(JSON.stringify(logs)).not.toContain(KEY);
    expect(calls[0]).toMatchObject({ promptId: "P-004", promptVersion: "0.2", model: "m-text" });
  });

  it("[TC-NFR-029] changing address and model names in config moves every call to the other service", async () => {
    const other = await startAiStub();
    other.script("text", reply(okBody()));

    await ask(input(), configFor({ baseUrl: other.baseUrl, modelText: "other-model" }));

    expect(other.requests[0].model).toBe("other-model");
    expect(stub.requests).toHaveLength(0);
    await other.close();
  });

  it("[TC-NFR-016] every outbound request goes to the configured AI address", async () => {
    stub.script("text", reply(okBody()));
    const urls: string[] = [];
    const spy: typeof fetch = (url, init) => {
      urls.push(String(url));
      return fetch(url, init);
    };

    await askAi(input(), { config: configFor(), fetch: spy, log: () => {} });

    expect(urls.every((u) => u.startsWith(stub.baseUrl))).toBe(true);
  });
});
