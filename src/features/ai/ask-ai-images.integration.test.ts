import { describe, expect, it } from "vitest";
import { reply } from "../../../test/ai-stub/ai-stub";
import { createImageLimiter } from "./image-limiter";
import { input, okReply, useAiStub } from "./test-kit";

const { state, ask } = useAiStub();
const picture = { mimeType: "image/png", data: new Uint8Array([1]) };
const pictures = (n: number) => Array.from({ length: n }, () => picture);
const clock = { ms: 0 };
const withLimiter = () => ({ imageLimiter: createImageLimiter(() => clock.ms) });

const sendPicture = (deps: ReturnType<typeof withLimiter>, chatId = "chat-1", count = 1) =>
  ask(input("", { chatId, images: pictures(count) }), deps);

const prepare = () => {
  clock.ms = 0;
  state.stub.script("ocr", reply("กาแฟเย็น 3 แก้ว 55"));
  state.stub.script("text", okReply());
  return withLimiter();
};

describe("picture reading limit (FR-AI-090 · FR-AI-120)", () => {
  it("[TC-AI-027] the 21st picture in the same minute is refused and the OCR service sees 20 calls", async () => {
    const deps = prepare();
    for (let i = 0; i < 20; i++) await sendPicture(deps);

    const result = await sendPicture(deps);

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(state.stub.count("ocr")).toBe(20);
  });

  it("[TC-AI-028] 20 pass at second 0, the next one passes after 61 seconds", async () => {
    const deps = prepare();
    for (let i = 0; i < 20; i++) expect(await sendPicture(deps)).toMatchObject({ ok: true });

    clock.ms = 61_000;

    expect(await sendPicture(deps)).toMatchObject({ ok: true });
    expect(state.stub.count("ocr")).toBe(21);
  });

  it("[TC-AI-029] the limit is shared between chats: 12 in chat A and 8 in chat B, the next one is refused", async () => {
    const deps = prepare();
    await sendPicture(deps, "chat-a", 12);
    await sendPicture(deps, "chat-b", 8);

    const result = await sendPicture(deps, "chat-b");

    expect(result).toMatchObject({ ok: false, code: "rate_limited" });
    expect(state.stub.count("ocr")).toBe(20);
  });

  it("[TC-AI-034] the refusal names the seconds to wait", async () => {
    const deps = prepare();
    await sendPicture(deps, "chat-1", 20);
    clock.ms = 10_000;

    const result = await sendPicture(deps);

    expect(result).toEqual({ ok: false, code: "rate_limited", userMessage: "อ่านรูปได้ไม่เกิน 20 รูปต่อนาที กรุณารอ 50 วินาทีแล้วส่งใหม่" });
  });

  it("[TC-AI-035] after the stated wait the picture is read and no wait message comes back", async () => {
    const deps = prepare();
    await sendPicture(deps, "chat-1", 20);
    clock.ms = 10_000;
    await sendPicture(deps);

    clock.ms = 61_000;
    const result = await sendPicture(deps);

    expect(result).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toContain("วินาที");
  });

  it("more than 20 pictures in one message can never fit, so it is refused without waiting advice", async () => {
    const deps = prepare();

    const result = await sendPicture(deps, "chat-1", 21);

    expect(result).toMatchObject({ ok: false, code: "rate_limited", userMessage: "ส่งรูปได้ครั้งละไม่เกิน 20 รูป" });
    expect(state.stub.count("ocr")).toBe(0);
  });

  it("text-only messages are not counted", async () => {
    const deps = prepare();
    await sendPicture(deps, "chat-1", 20);

    expect(await ask(input(), deps)).toMatchObject({ ok: true });
  });
});
