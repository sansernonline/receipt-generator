import fsp from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { GET as getDraft } from "@/app/api/chats/[id]/draft/route";
import { POST as confirm } from "@/app/api/chats/[id]/shop/route";
import { okReply } from "@/features/ai/test-kit";
import { useChatWithDraft } from "@/features/draft/chat-harness";
import { emptyDraft } from "@/features/draft/parse-draft";
import { addWater } from "@/features/draft/test-kit";
import { cashShop } from "./test-kit";

const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };

describe('POST /api/chats/[id]/shop: the user\'s "ใช้หัวบิลนี้" (FR-HDR-070 · 080)', () => {
  const { send, stub, dataDir, chatId, readChatFile } = useChatWithDraft(emptyDraft, { hasShop: false });
  const post = (body: unknown, over: Record<string, string> = {}) =>
    confirm(new Request("http://localhost/api/shop", { method: "POST", headers: { ...headers, ...over }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: chatId() }) });
  const shopFile = async (shopId: string) => JSON.parse(await fsp.readFile(path.join(dataDir(), "shops", shopId, "shop.json"), "utf8"));
  const openedDraft = async () => (await getDraft(new Request("http://localhost/x"), { params: Promise.resolve({ id: chatId() }) })).json();

  test("[TC-HDR-022] before the button the bill has no shop; after it the draft route answers with the shop", async () => {
    expect((await openedDraft()).shop).toBeNull();

    const res = await post(cashShop);

    expect(res.status).toBe(201);
    expect((await openedDraft()).shop).toMatchObject({ shopName: "ร้านกาแฟบ้านสวน", template: "cash" });
  });

  test("[FR-HDR-070] the shop is saved in shops/<id>/shop.json, the chat points to it, and the index follows", async () => {
    const { shop } = await (await post(cashShop)).json();

    expect(await shopFile(shop.id)).toEqual(shop);
    expect((await readChatFile()).shopId).toBe(shop.id);
    const index = JSON.parse(await fsp.readFile(path.join(dataDir(), "index.json"), "utf8"));
    expect(index.chats.find((chat: { id: string }) => chat.id === chatId()).shopId).toBe(shop.id);
  });

  test("[TC-HDR-024] an address edited in the card is what is saved", async () => {
    const { shop } = await (await post({ ...cashShop, address: "99/9 ถ.พระยาสัจจา ชลบุรี" })).json();

    expect((await shopFile(shop.id)).address).toBe("99/9 ถ.พระยาสัจจา ชลบุรี");
  });

  test.each([["12 digits", "010556000000"], ["14 digits", "01055600000012"], ["letters", "01055600000AB"]])("[TC-HDR-025] a tax id of %s is refused and nothing is saved", async (_name, taxId) => {
    const res = await post({ ...cashShop, taxId });

    expect(res.status).toBe(400);
    expect((await res.json()).fields.taxId).toContain("13 หลัก");
    expect((await readChatFile()).shopId).toBeNull();
  });

  test("[TC-HDR-025] 13 digits with a wrong check digit is accepted (a warning only)", async () => {
    expect((await post({ ...cashShop, taxId: "0105560000001" })).status).toBe(201);
  });

  test("[FR-HDR-080] an empty shop name is refused", async () => {
    expect((await post({ ...cashShop, shopName: " " })).status).toBe(400);
  });

  test("[NFR-SEC-040] a request from another origin is refused and saves nothing", async () => {
    const res = await post(cashShop, { origin: "http://evil.example" });

    expect(res.status).toBe(403);
    expect((await readChatFile()).shopId).toBeNull();
  });

  test("[review] a body that is not a shop is a 400 with no path or key in the answer", async () => {
    const res = await post({ shopName: 123 });

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toMatch(/[\\/]|TESTKEY/);
  });

  test("[FR-HDR-100] a second confirm is refused with 409 and the shop stays as it was", async () => {
    const { shop } = await (await post(cashShop)).json();

    const res = await post({ ...cashShop, shopName: "ร้านปลอม" });

    expect(res.status).toBe(409);
    expect((await shopFile(shop.id)).shopName).toBe("ร้านกาแฟบ้านสวน");
  });

  test("[FR-HDR-100] after the shop is set, a chat command to rename the shop is refused and shop.json is untouched", async () => {
    const { shop } = await (await post(cashShop)).json();
    stub().script("text", okReply({ operations: [addWater, { op: "set_shop_name", name: "ร้านปลอม" }] }));

    const res = await send("เปลี่ยนชื่อร้านเป็น ร้านปลอม");

    expect(res.draft.items).toEqual([]);
    expect(res.shop?.shopName).toBe("ร้านกาแฟบ้านสวน");
    expect(await shopFile(shop.id)).toEqual(shop);
    expect(stub().requests[0].body.messages[0].content).toContain("คุณคือตัวแปลคำสั่งของแอปออกบิลภาษาไทย");
  });

  test("[review] a shop.json that is damaged counts as no shop: the user can confirm again, not stay locked out", async () => {
    const { shop } = await (await post(cashShop)).json();
    await fsp.writeFile(path.join(dataDir(), "shops", shop.id, "shop.json"), "{ not json");

    const res = await post({ ...cashShop, shopName: "ร้านใหม่" });

    expect(res.status).toBe(201);
    expect((await openedDraft()).shop.shopName).toBe("ร้านใหม่");
  });

  test("[review] a shop.json that is gone counts as no shop too", async () => {
    const { shop } = await (await post(cashShop)).json();
    await fsp.rm(path.join(dataDir(), "shops", shop.id), { recursive: true });

    expect((await post(cashShop)).status).toBe(201);
  });

  test("[review] two confirms at the same time: one is saved, the other gets 409", async () => {
    const statuses = (await Promise.all([post(cashShop), post({ ...cashShop, shopName: "ร้านอื่น" })])).map((res) => res.status).sort();

    expect(statuses).toEqual([201, 409]);
  });
});
