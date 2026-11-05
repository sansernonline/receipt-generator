import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { okReply, refuseReply } from "@/features/ai/test-kit";
import { useChatWithDraft } from "./chat-harness";
import { NOTICE_BAD_VALUE } from "./notices";
import { draftWith } from "./test-kit";

const ops = (...operations: unknown[]) => okReply({ operations });
const setPayment = (method: unknown, date: unknown = null) => ({ op: "set_payment", method, date });

describe("footer commands from the chat", () => {
  const { stub, send, readDraftFile } = useChatWithDraft(draftWith);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T05:00:00Z")); // 18 Oct 2569 12:00 Bangkok
  });
  afterEach(() => vi.useRealTimers());

  test("[TC-TOT-030] 'จ่ายโอน' sets the method to transfer in the answer and in draft.json", async () => {
    stub().script("text", ops(setPayment("transfer")));

    const res = await send("จ่ายโอน");

    expect(res.draft.footer.paymentMethod).toBe("transfer");
    expect((await readDraftFile()).footer.paymentMethod).toBe("transfer");
  });

  test("[TC-TOT-031] cash then cheque are both set", async () => {
    stub().script("text", ops(setPayment("cash")));
    const first = await send("จ่ายเงินสด");
    stub().script("text", ops(setPayment("cheque")));

    const second = await send("จ่ายเช็ค");

    expect([first.draft.footer.paymentMethod, second.draft.footer.paymentMethod]).toEqual(["cash", "cheque"]);
  });

  test("[TC-TOT-032] a method outside the 3 kinds is not set: the method stays cash and a notice shows", async () => {
    stub().script("text", ops(setPayment("cash")));
    await send("จ่ายเงินสด");
    stub().script("text", ops(setPayment("credit_card")));

    const res = await send("จ่ายบัตรเครดิต");

    expect(res.draft.footer.paymentMethod).toBe("cash");
    expect((await readDraftFile()).footer.paymentMethod).toBe("cash");
    expect(res.notices[0]).toMatch(/เงินสด.*โอน.*เช็ค/);
  });

  test("[TC-TOT-032] the model refusing the card keeps the method cash", async () => {
    stub().script("text", ops(setPayment("cash")));
    await send("จ่ายเงินสด");
    stub().script("text", refuseReply("not_supported"));

    const res = await send("จ่ายบัตรเครดิต");

    expect(res.draft.footer.paymentMethod).toBe("cash");
  });

  test("[TC-TOT-033] the remark is stored exactly (shown on the bill: blocked, waits for row 32 bill preview)", async () => {
    stub().script("text", ops({ op: "set_remarks", text: "รับกลับบ้าน" }));

    const res = await send("หมายเหตุ รับกลับบ้าน");

    expect(res.draft.footer.remarks).toBe("รับกลับบ้าน");
    expect((await readDraftFile()).footer.remarks).toBe("รับกลับบ้าน");
  });

  test("[TC-TOT-035] an HTML remark is stored as raw text (rendering as text: blocked, waits for rows 32 and 46)", async () => {
    stub().script("text", ops({ op: "set_remarks", text: "<img src=x onerror=alert(1)>" }));

    await send("หมายเหตุ <img src=x onerror=alert(1)>");

    expect((await readDraftFile()).footer.remarks).toBe("<img src=x onerror=alert(1)>");
  });

  test("[TC-TOT-044] 'วันที่ชำระ 20 ต.ค.' gives 20/10/2569 while the clock says 18 Oct 2569", async () => {
    stub().script("text", ops(setPayment("cash", { d: 20, m: 10, y: null, era: null })));

    const res = await send("วันที่ชำระ 20 ต.ค.");

    expect(res.draft.footer.paymentDate).toEqual({ d: 20, m: 10, y: 2569, era: "BE" });
  });

  test("[TC-TOT-034] 501 visible characters are not saved: the remark stays at 500 and the notice says the 500 limit", async () => {
    stub().script("text", ops({ op: "set_remarks", text: "ก".repeat(500) }));
    await send("หมายเหตุยาว");
    stub().script("text", ops({ op: "set_remarks", text: "ก".repeat(501) }));

    const res = await send("หมายเหตุยาวกว่าเดิม");

    expect(res.draft.footer.remarks).toBe("ก".repeat(500));
    expect((await readDraftFile()).footer.remarks).toBe("ก".repeat(500));
    expect(res.notices[0]).toContain("500 ตัวอักษร");
  });

  test("[TC-TOT-045] 31 Feb through the chat is refused with a notice and the date stays empty", async () => {
    stub().script("text", ops(setPayment("cash", { d: 31, m: 2, y: null, era: null })));

    const res = await send("วันที่ชำระ 31 ก.พ.");

    expect(res.notices).toEqual([NOTICE_BAD_VALUE]);
    expect((await readDraftFile()).footer.paymentDate).toBeNull();
  });

  test("[TC-TOT-045] 29 Feb is accepted when the clock is in 2571 (CE 2028, a leap year)", async () => {
    vi.setSystemTime(new Date("2028-03-01T05:00:00Z"));
    stub().script("text", ops(setPayment("cash", { d: 29, m: 2, y: null, era: null })));

    const res = await send("วันที่ชำระ 29 ก.พ.");

    expect(res.draft.footer.paymentDate).toEqual({ d: 29, m: 2, y: 2571, era: "BE" });
  });
});
