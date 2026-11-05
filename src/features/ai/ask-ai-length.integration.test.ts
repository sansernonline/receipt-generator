import { describe, expect, it } from "vitest";
import { input, okReply, useAiStub } from "./test-kit";

const { state, ask } = useAiStub();
const LIMIT_TEXT = "ข้อความยาวได้ไม่เกิน 10,000 ตัวอักษร";

describe("message length (FR-AI-080)", () => {
  it("[TC-AI-024] 10,001 characters: not forwarded, the limit is told, no AI call", async () => {
    state.stub.script("text", okReply());

    const result = await ask(input("ก".repeat(10_001)));

    expect(result).toEqual({ ok: false, code: "message_too_long", userMessage: LIMIT_TEXT });
    expect(state.stub.requests).toHaveLength(0);
  });

  it("[TC-AI-025] exactly 10,000 characters: accepted and forwarded once", async () => {
    state.stub.script("text", okReply());

    const result = await ask(input("ก".repeat(10_000)));

    expect(result).toMatchObject({ ok: true });
    expect(state.stub.count("text")).toBe(1);
  });

  it("[TC-AI-024] a too long text with pictures does not start reading the pictures", async () => {
    const picture = { mimeType: "image/png", data: new Uint8Array([1]) };

    await ask(input("ก".repeat(10_001), { images: [picture] }));

    expect(state.stub.requests).toHaveLength(0);
  });

  it("counts visible characters like the chat does: Thai vowel marks do not add to the count", async () => {
    state.stub.script("text", okReply());

    const result = await ask(input("กี่".repeat(3334)));

    expect(result).toMatchObject({ ok: true });
  });
});
