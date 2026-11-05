import { describe, expect, it } from "vitest";
import { reply } from "../../../test/ai-stub/ai-stub";
import { input, okBody, okReply, refuseReply, useAiStub } from "./test-kit";

const { state, ask } = useAiStub();
const OUT_OF_SCOPE_TEXT = "BILLGEN ช่วยได้เฉพาะเรื่องออกบิล ลองพิมพ์รายการสินค้าหรือสั่งแก้บิลได้เลย";

describe("out-of-scope requests (FR-AI-060 · FR-AI-110)", () => {
  it("[TC-AI-017][TC-AI-032] a refusal gives the fixed text that steers back to billing, and no operations", async () => {
    state.stub.script("text", refuseReply("out_of_scope"));

    const result = await ask(input("เขียนโค้ด Python ให้หน่อย"));

    expect(result).toEqual({ ok: false, code: "refused", userMessage: OUT_OF_SCOPE_TEXT });
    expect(state.stub.count("text")).toBe(1);
  });

  it("[TC-AI-018] a refusal that carries a remove_item is still a refusal and nothing is applied", async () => {
    const withDelete = { operations: [{ op: "remove_item", line: 1 }] };
    state.stub.script("text", refuseReply("out_of_scope", withDelete));

    const result = await ask(input("เขียนโค้ด Python ให้หน่อย"));

    expect(result).toMatchObject({ ok: false, code: "refused", userMessage: OUT_OF_SCOPE_TEXT });
    expect(result).not.toHaveProperty("operations");
  });

  it("[TC-AI-017] a button refusal shows the button text, not words from the AI", async () => {
    state.stub.script("text", refuseReply("use_button", { action: "delete_chat" }));

    const result = await ask(input("ลบแชตนี้"));

    expect(result).toMatchObject({ ok: false, userMessage: "ลบแชตได้ที่ปุ่มลบเท่านั้น" });
  });

  it("[TC-AI-033] a normal reply carries no steer-back text", async () => {
    state.stub.script("text", okReply());

    const result = await ask();

    expect(result).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toContain("ลองพิมพ์รายการสินค้า");
  });

  it("the AI's own words in a refusal are never shown", async () => {
    state.stub.script("text", reply(okBody({ status: "refuse", reason: "internal_info", operations: [], reply: null, question: "SECRET-WORDS" })));

    expect(JSON.stringify(await ask())).not.toContain("SECRET-WORDS");
  });
});
