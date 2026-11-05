import { describe, expect, test } from "vitest";
import { okReply } from "@/features/ai/test-kit";
import { reply } from "../../../test/ai-stub/ai-stub";
import { useChatWithDraft } from "./chat-harness";
import { coffee, draftWith } from "./test-kit";

const iced = { ...coffee, name: "กาแฟเย็น" };
const icedMilk = { ...coffee, name: "กาแฟเย็นนมสด", unitPrice: 70 };
const question = "หมายถึงกาแฟเย็น หรือกาแฟเย็นนมสด";
const clarify = (operations: unknown[]) => reply({ status: "clarify", reason: null, action: null, operations, question, reply: null });

describe("item commands: ambiguous name (FR-ITEM-090)", () => {
  const { stub, send, readDraftFile } = useChatWithDraft(() => draftWith([iced, icedMilk]));

  test("[TC-ITEM-024] 'ลบกาแฟ' with 2 lines starting the same: nothing is removed, one question is shown", async () => {
    stub().script("text", clarify([]));

    const res = await send("ลบกาแฟ");

    expect(res.draft.items).toEqual([iced, icedMilk]);
    expect(await readDraftFile()).toMatchObject({ items: [{ name: "กาแฟเย็น" }, { name: "กาแฟเย็นนมสด" }] });
    expect(res.messages.at(-1)?.text).toBe(question);
  });

  test("[TC-ITEM-024] the AI was shown both lines of the draft", async () => {
    stub().script("text", clarify([]));

    await send("ลบกาแฟ");

    const body = JSON.stringify(stub().requests[0].body);
    expect(body).toContain("กาแฟเย็นนมสด");
  });

  test("[TC-ITEM-024] a question that carries a remove_item is refused by the check: the server never picks a line itself", async () => {
    stub().script("text", clarify([{ op: "remove_item", line: 1 }]), clarify([{ op: "remove_item", line: 1 }]));

    const res = await send("ลบกาแฟ");

    expect(res.draft.items).toEqual([iced, icedMilk]);
    expect(res.error).toBe("invalid_reply");
  });

  test("[TC-ITEM-025] the full name 'กาแฟเย็นนมสด' removes only that line, no question", async () => {
    stub().script("text", okReply({ operations: [{ op: "remove_item", line: 2 }] }));

    const res = await send("ลบกาแฟเย็นนมสด");

    expect(res.draft.items).toEqual([iced]);
    expect(res.totals.net).toBe(165);
    expect(res.messages.at(-1)?.text).not.toContain("หมายถึง");
  });
});
