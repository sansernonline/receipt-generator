import { describe, expect, test } from "vitest";
import { okReply } from "@/features/ai/test-kit";
import { useChatWithDraft } from "./chat-harness";
import { draftWith } from "./test-kit";

const setBill = (fields: Record<string, unknown>) => okReply({ operations: [{ op: "set_bill_info", fields }] });

describe("bill info from the chat", () => {
  const { stub, send, readDraftFile } = useChatWithDraft(draftWith);

  test("[TC-HDR-034] customer name and bill number reach the draft in the answer and in draft.json (the preview half waits for the bill preview row)", async () => {
    stub().script("text", setBill({ customer_name: "คุณสมชาย ใจดี", doc_no: "RC-0042" }));

    const res = await send("ลูกค้าคุณสมชาย ใจดี เลขที่ RC-0042");

    expect(res.draft.bill).toMatchObject({ customerName: "คุณสมชาย ใจดี", billNumber: "RC-0042" });
    expect((await readDraftFile()).bill).toMatchObject({ customerName: "คุณสมชาย ใจดี", billNumber: "RC-0042" });
  });

  test("[TC-HDR-056] name, phone and email are stored exactly as typed", async () => {
    stub().script("text", setBill({ customer_name: "คุณสมชาย ใจดี", customer_phone: "081-234-5678", customer_email: "somchai@example.com" }));

    await send("ลูกค้าคุณสมชาย ใจดี โทร 081-234-5678 อีเมล somchai@example.com");

    expect((await readDraftFile()).bill).toMatchObject({
      customerName: "คุณสมชาย ใจดี", customerPhone: "081-234-5678", customerEmail: "somchai@example.com",
    });
  });

  test("[TC-HDR-036] a date that does not exist is refused with a Thai notice and the draft file keeps its date", async () => {
    stub().script("text", setBill({ doc_date: { d: 31, m: 2, y: 2569, era: "BE" } }));

    const res = await send("วันที่ 31 ก.พ. 2569");

    expect(res.notices).toHaveLength(1);
    expect((await readDraftFile()).bill.billDate).toBeNull();
  });

  test("[TC-HDR-036] 29 Feb 2567 is stored as 29/02/2567", async () => {
    stub().script("text", setBill({ doc_date: { d: 29, m: 2, y: 2567, era: "BE" } }));

    await send("วันที่ 29 ก.พ. 2567");

    expect((await readDraftFile()).bill.billDate).toEqual({ d: 29, m: 2, y: 2567, era: "BE" });
  });
});
