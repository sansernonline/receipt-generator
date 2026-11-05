import { describe, expect, test } from "vitest";
import { okReply } from "@/features/ai/test-kit";
import { useChatWithDraft } from "@/features/draft/chat-harness";
import { emptyDraft } from "@/features/draft/parse-draft";
import { reply } from "../../../test/ai-stub/ai-stub";
import { shopReplyBody } from "./test-kit";

const TEXT = "ร้านกาแฟบ้านสวน 12/3 ถ.สุขุมวิท ชลบุรี โทร 038-123456 ออกบิลเงินสด";
const NO_SHOP_INFO = { ...shopReplyBody({ status: "empty" }), header: null };

describe("a message in a chat with no shop header (FR-HDR-060)", () => {
  const { stub, send, readDraftFile, readChatFile } = useChatWithDraft(emptyDraft, { hasShop: false });

  test("[TC-HDR-020] shop info gives a card with name, address, phone and the cash bill template", async () => {
    stub().script("text", reply(shopReplyBody()));

    const res = await send(TEXT);

    expect(res.shopCard).toEqual({ shopName: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี", taxId: "", phone: "038-123456", email: "", template: "cash" });
  });

  test("[TC-HDR-020] the card is only a proposal: no shop is saved and the draft stays empty", async () => {
    stub().script("text", reply(shopReplyBody()));

    const res = await send(TEXT);

    expect(res.shop).toBeNull();
    expect((await readChatFile()).shopId).toBeNull();
    expect(await readDraftFile()).toEqual(emptyDraft());
  });

  test("[TC-HDR-020] the shop prompt (P-002) is used and the typed text goes in the user_message tag", async () => {
    stub().script("text", reply(shopReplyBody()));

    await send(TEXT);

    const [{ body }] = stub().requests;
    expect(body.messages[0].content).toContain("อ่านข้อความที่ผู้ใช้พิมพ์บอกข้อมูลร้านของตัวเอง");
    expect(body.messages[1].content).toContain(`<user_message>\n${TEXT}\n</user_message>`);
  });

  test("[TC-HDR-020] no document type given: the card starts on the receipt template", async () => {
    stub().script("text", reply(shopReplyBody({}, { doc_type: null })));

    const res = await send("ร้านกาแฟบ้านสวน");

    expect(res.shopCard?.template).toBe("receipt");
  });

  test("[TC-HDR-021] a message with no shop info gives no card, a Thai hint, and the draft does not change", async () => {
    stub().script("text", reply(NO_SHOP_INFO));

    const res = await send("สวัสดีครับ");

    expect(res.shopCard).toBeUndefined();
    expect(res.notices).toEqual(["ยังไม่มีหัวบิล เริ่มจากพิมพ์ข้อมูลร้านในแชต (ชื่อ ที่อยู่ โทร และชนิดเอกสาร)"]);
    expect(res.draft).toEqual(emptyDraft());
    expect(await readDraftFile()).toEqual(emptyDraft());
  });

  test("[TC-HDR-021] a header with every field empty also gives no card", async () => {
    const blank = { doc_type: null, shop_name: null, address: null, tax_id: null, phone: null, email: null };
    stub().script("text", reply(shopReplyBody({}, blank)));

    expect((await send("สวัสดี")).shopCard).toBeUndefined();
  });

  test("[TC-HDR-023] a shop_name of 123 (wrong type) every time gives no card, a Thai text, and one retry", async () => {
    stub().script("text", reply(shopReplyBody({}, { shop_name: 123 })));

    const res = await send(TEXT);

    expect(res.shopCard).toBeUndefined();
    expect(res.shop).toBeNull();
    expect(res.notices).toEqual(["ยังอ่านคำสั่งไม่ได้ ลองพิมพ์ใหม่"]);
    expect(stub().count("text")).toBe(2);
  });

  test("[TC-HDR-023] a field the schema does not know (a customer) is refused too, even when the rest is right", async () => {
    stub().script("text", reply(shopReplyBody({}, { customer: "คุณสมชาย" })));

    expect((await send(TEXT)).shopCard).toBeUndefined();
  });

  test("[TC-HDR-023] a tax id with letters is refused", async () => {
    stub().script("text", reply(shopReplyBody({}, { tax_id: "01055600000AB" })));

    expect((await send(TEXT)).shopCard).toBeUndefined();
  });

  test("[FR-AI-070] an out-of-scope request gets the fixed Thai refusal and no card", async () => {
    stub().script("text", reply({ ...shopReplyBody({ status: "refuse", reason: "out_of_scope" }), header: null }));

    const res = await send("เขียนโค้ดให้หน่อย");

    expect(res.shopCard).toBeUndefined();
    expect(res.notices[0]).toContain("BILLGEN ช่วยได้เฉพาะเรื่องออกบิล");
  });

  test("[FR-HDR-060] a P-004 style answer (operations) in a chat with no shop never reaches the draft", async () => {
    stub().script("text", okReply());

    const res = await send("เพิ่มน้ำเปล่า 1 ขวด 10");

    expect(res.draft.items).toEqual([]);
    expect(res.shopCard).toBeUndefined();
  });

  test("[FR-CHAT-030] has_bill_content true is passed on as shopCardHasBill so the browser can send the text again", async () => {
    stub().script("text", reply(shopReplyBody({ has_bill_content: true })));

    expect((await send(TEXT)).shopCardHasBill).toBe(true);
  });

  test("[FR-CHAT-030] has_bill_content false gives no flag", async () => {
    stub().script("text", reply(shopReplyBody()));

    expect((await send(TEXT)).shopCardHasBill).toBeUndefined();
  });
});
