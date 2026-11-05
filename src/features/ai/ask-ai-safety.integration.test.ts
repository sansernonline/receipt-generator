import { describe, expect, it } from "vitest";
import { reply } from "../../../test/ai-stub/ai-stub";
import { askAi } from "./ask-ai";
import { input, okBody, okReply, useAiStub } from "./test-kit";

const { state, ask, configFor } = useAiStub();
const picture = { mimeType: "image/png", data: new Uint8Array([1]) };
const asText = (s: string) => reply(s);

describe("odd replies and failures never escape as exceptions", () => {
  it.each([
    ["op constructor", okBody({ operations: [{ op: "constructor" }] })],
    ["extra field constructor", okBody({ operations: [JSON.parse('{"op":"remove_item","line":1,"constructor":1}')] })],
  ])("[review] %s: asked again once, then invalid_reply", async (_n, body) => {
    state.stub.script("text", reply(body));

    const result = await ask();

    expect(result).toMatchObject({ ok: false, code: "invalid_reply" });
    expect(state.stub.count("text")).toBe(2);
  });

  it("[review] a reply with set __proto__ goes through askAi as invalid_reply", async () => {
    const raw = '{"status":"ok","reason":null,"action":null,"question":null,"reply":"x","operations":[{"op":"update_item","line":1,"set":{"__proto__":1}}]}';
    state.stub.script("text", asText(raw));

    expect(await ask()).toMatchObject({ ok: false, code: "invalid_reply" });
  });

  it("[review] an internal error becomes a Thai failure, writes an error event, and shows no error text", async () => {
    state.stub.script("text", okReply());
    const broken = { chatId: "chat-1", userText: "x", draft: {} } as never;

    const result = await ask(broken);

    expect(result).toMatchObject({ ok: false, code: "ai_unreachable" });
    expect(state.logs.at(-1)).toEqual({ at: expect.any(String), event: "error", chatId: "chat-1" });
    expect(JSON.stringify(result)).not.toMatch(/TypeError|undefined/);
  });

  it("[review] a fetch that throws is handled too", async () => {
    const boom: typeof fetch = () => { throw new TypeError("secret path"); };

    const result = await askAi(input(), { config: configFor(), fetch: boom, log: () => {} });

    expect(result).toMatchObject({ ok: false, code: "ai_unreachable" });
  });

  it("[review] requests do not follow redirects", async () => {
    state.stub.script("text", okReply());
    const seen: (RequestRedirect | undefined)[] = [];
    const spy: typeof fetch = (url, init) => { seen.push(init?.redirect); return fetch(url, init); };

    await askAi(input(), { config: configFor(), fetch: spy, log: () => {} });

    expect(seen).toEqual(["error"]);
  });
});

describe("picture text that is too long", () => {
  const lots = Array.from({ length: 300 }, (_, i) => `รายการ ${i} ${"ก".repeat(40)}`).join("\n");

  it("[review] sends the user text only with the first piece", async () => {
    state.stub.script("ocr", reply(lots));
    state.stub.script("text", okReply());

    await ask(input("ข้อความผู้ใช้ที่ยาว", { images: [picture] }));

    const users = state.stub.requests.filter((r) => r.kind === "text").map((r) => r.body.messages.at(-1).content as string);
    expect(users.length).toBeGreaterThan(1);
    expect(users[0]).toContain("ข้อความผู้ใช้ที่ยาว");
    expect(users.slice(1).every((u) => !u.includes("ข้อความผู้ใช้ที่ยาว"))).toBe(true);
  });

  it("[review] more than AI_MAX_CHUNKS pieces: told to send less, and no text call is made", async () => {
    state.stub.script("ocr", reply(lots));

    const result = await ask(input("", { images: [picture] }), { config: configFor({ maxChunks: 1 }) });

    expect(result).toMatchObject({ ok: false, code: "too_long_input" });
    expect(state.stub.count("text")).toBe(0);
  });

  it("[review] 10,000 characters of user text plus a picture can never make more than the cap of calls", async () => {
    state.stub.script("ocr", reply("ก".repeat(20_000)));
    state.stub.script("text", okReply());

    await ask(input("ก".repeat(10_000), { images: [picture] }));

    expect(state.stub.count("text")).toBeLessThanOrEqual(5);
  });

  it("[review] picture text cut at 20,000 characters tells the user only part was read", async () => {
    state.stub.script("ocr", reply("ก".repeat(25_000)));
    state.stub.script("text", okReply());

    const result = await ask(input("", { images: [picture] }), { config: configFor({ maxChunks: 50 }) });

    expect(result).toMatchObject({ ok: true });
    expect((result as { reply: string }).reply).toContain("อ่านจากรูปได้บางส่วน");
  });
});
