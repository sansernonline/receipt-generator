import { describe, expect, test } from "vitest";
import { okReply } from "@/features/ai/test-kit";
import { useChatWithDraft } from "./chat-harness";
import { issueBlockers } from "./issue-blockers";
import { draftWith } from "./test-kit";

const discount = (type: string, value: number) => okReply({ operations: [{ op: "set_discount", type, value }] });
const arrow = /\d[\d,]*\.\d\d → -?\d[\d,]*\.\d\d/;

describe("net change and negative warning in the answer", () => {
  const { stub, send } = useChatWithDraft(draftWith);

  test("[TC-TOT-036] a 300 baht discount on 295.00 shows -5.00 as a warning, not an error", async () => {
    stub().script("text", discount("amount", 300));

    const res = await send("ลดท้ายบิล 300 บาท");

    expect(res.totals.net).toBe(-5);
    expect(res.notices).toEqual(["ยอดสุทธิ 295.00 → -5.00 บาท", "ยอดติดลบ ออกบิลไม่ได้จนกว่าจะแก้ส่วนลด"]);
    expect(res.error).toBeUndefined();
  });

  test("[TC-TOT-039] a 10% discount shows '295.00 → 265.50'", async () => {
    stub().script("text", discount("percent", 10));

    const res = await send("ลดท้ายบิล 10%");

    expect(res.notices.join(" ")).toContain("295.00 → 265.50");
  });

  test("[TC-TOT-040] a payment command and a 0% discount show no before → after", async () => {
    stub().script("text", okReply({ operations: [{ op: "set_payment", method: "transfer", date: null }] }), discount("percent", 0));

    const payment = await send("จ่ายโอน");
    const zero = await send("ลดท้ายบิล 0%");

    expect([payment.notices.join(" "), zero.notices.join(" ")].filter((t) => arrow.test(t))).toEqual([]);
  });

  test("[TC-TOT-043] fixing the discount to 20 baht gives 275.00 and nothing blocks issuing (the button: blocked, waits for row 42)", async () => {
    stub().script("text", discount("amount", 300), discount("amount", 20));
    const negative = await send("ลดท้ายบิล 300 บาท");

    const fixed = await send("ลดท้ายบิล 20 บาท");

    expect([issueBlockers(negative.draft).length, issueBlockers(fixed.draft)]).toEqual([1, []]);
    expect(fixed.notices[0]).toBe("ยอดสุทธิ -5.00 → 275.00 บาท");
    expect(fixed.notices).toHaveLength(1);
  });

  test("[TC-TOT-048] the missing price shows in issueBlockers until the chat fills it (the route: blocked, waits for row 42)", async () => {
    const water = { op: "add_item", name: "น้ำเปล่า", qty: 1, unit: "ขวด", unit_price: null, code: null, description: null };
    stub().script("text", okReply({ operations: [water] }), okReply({ operations: [{ op: "update_item", line: 3, set: { unit_price: 10 } }] }));
    const added = await send("เพิ่มน้ำเปล่า 1 ขวด");

    const filled = await send("น้ำเปล่าราคา 10");

    expect([issueBlockers(added.draft), issueBlockers(filled.draft)]).toEqual([["บรรทัด 3 ยังไม่มีราคา ใส่ราคาก่อนออกบิล"], []]);
  });
});
