import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "@/features/chat/chat-shell";
import { acknowledgeAiNotice } from "@/features/consent/ai-notice-flag";
import { totalsOf } from "@/features/draft/draft-totals";
import { emptyDraft } from "@/features/draft/parse-draft";
import { cashShop } from "./test-kit";
import type { ShopFields } from "./types";

const A = "11111111-1111-4111-8111-111111111111";
const TEXT = "ร้านกาแฟบ้านสวน 12/3 ถ.สุขุมวิท ชลบุรี โทร 038-123456 ออกบิลเงินสด";
const OTHER = "33333333-3333-4333-8333-333333333333";
const chat = { id: A, title: "แชตใหม่", updatedAt: "2026-10-18T04:00:00Z", isStale: false };
const pair = { draft: emptyDraft(), totals: totalsOf(emptyDraft()) };

type Server = { posted: ShopFields[]; messages: string[]; shopStatus: number; shopBody: object | null; cardFor: ShopFields | null; hasBill: boolean; failSecondMessage: boolean; holdShop: Promise<void> | null };
let server: Server;

// the browser's calls go to a fake server: it answers the message with `cardFor` and echoes the shop it is asked to save
function stubServer() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/chats" && init?.method === "POST") return Response.json({ chat });
      if (url === "/api/chats") return Response.json({ chats: [{ id: OTHER, title: "แชตอื่น", updatedAt: "2026-10-18T03:00:00Z", isStale: false }] });
      if (url.endsWith(OTHER)) return Response.json({ chat: { id: OTHER, title: "แชตอื่น", updatedAt: "2026-10-18T03:00:00Z", shopId: null, messages: [{ role: "user", text: "ของแชตอื่น" }] }, draft: { items: [] } });
      if (url.endsWith("/messages")) {
        server.messages.push(JSON.parse(String(init?.body)).text);
        if (server.messages.length > 1) return server.failSecondMessage ? new Response("{}", { status: 500 }) : Response.json({ chat, message: { role: "user", text: TEXT, createdAt: "x" }, messages: [], draft: pair.draft, totals: pair.totals, shop: null, notices: [] }, { status: 201 });
        const message = { role: "user", text: TEXT, createdAt: "2026-10-18T05:00:00Z" };
        const notices = server.cardFor ? [] : ["ยังไม่มีหัวบิล เริ่มจากพิมพ์ข้อมูลร้านในแชต (ชื่อ ที่อยู่ โทร และชนิดเอกสาร)"];
        return Response.json({ chat, message, messages: [message], ...pair, shop: null, shopCard: server.cardFor ?? undefined, shopCardHasBill: server.hasBill || undefined, notices }, { status: 201 });
      }
      if (url.endsWith("/shop")) {
        const fields = JSON.parse(String(init?.body)) as ShopFields;
        server.posted.push(fields);
        await server.holdShop;
        return server.shopBody ? Response.json(server.shopBody, { status: server.shopStatus }) : Response.json({ ...pair, shop: { id: A, ...fields } }, { status: 201 });
      }
      return new Response("{}", { status: 500 });
    }),
  );
}

beforeEach(() => {
  server = { posted: [], messages: [], shopStatus: 201, shopBody: null, cardFor: cashShop, hasBill: false, failSecondMessage: false, holdShop: null };
  acknowledgeAiNotice();
  stubServer();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const preview = () => screen.getByRole("region", { name: "ตัวอย่างบิล" });
const button = () => screen.getByRole("button", { name: "ใช้หัวบิลนี้" });

async function sendShopText() {
  render(<ChatShell />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "ข้อความ" })).toBeEnabled());
  fireEvent.change(screen.getByRole("textbox", { name: "ข้อความ" }), { target: { value: TEXT } });
  fireEvent.click(screen.getByRole("button", { name: "ส่ง" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "ข้อความ" })).toBeEnabled());
}

const field = (name: string) => screen.getByRole(name === "แม่แบบ" ? "combobox" : "textbox", { name: new RegExp(name) });

test("[TC-HDR-022] the card shows the proposal and the bill does not use it until the button is pressed", async () => {
  await sendShopText();

  expect(field("ชื่อร้าน")).toHaveValue("ร้านกาแฟบ้านสวน");
  expect(button()).toBeInTheDocument();
  expect(within(preview()).queryByText("ร้านกาแฟบ้านสวน")).toBeNull();
  expect(server.posted).toEqual([]);
});

test("[TC-HDR-020] the card has name, address, phone and the cash bill template", async () => {
  await sendShopText();

  expect(field("ที่อยู่")).toHaveValue("12/3 ถ.สุขุมวิท ชลบุรี");
  expect(field("โทรศัพท์")).toHaveValue("038-123456");
  expect(field("แม่แบบ")).toHaveDisplayValue("บิลเงินสด");
});

test("[TC-HDR-022] pressing the button puts the shop name on the bill and takes the card away", async () => {
  await sendShopText();

  fireEvent.click(button());

  expect(await within(preview()).findByText("ร้านกาแฟบ้านสวน")).toBeInTheDocument();
  expect(within(preview()).getByRole("article", { name: "บิลเงินสด" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ใช้หัวบิลนี้" })).toBeNull();
});

test("[TC-HDR-024] an address edited in the card is sent and shows on the bill", async () => {
  await sendShopText();

  fireEvent.change(field("ที่อยู่"), { target: { value: "99/9 ถ.พระยาสัจจา ชลบุรี" } });
  fireEvent.click(button());

  expect(await within(preview()).findByText("99/9 ถ.พระยาสัจจา ชลบุรี")).toBeInTheDocument();
  expect(server.posted[0].address).toBe("99/9 ถ.พระยาสัจจา ชลบุรี");
});

test("[FR-HDR-080] the template can be changed in the card before it is used", async () => {
  await sendShopText();

  fireEvent.change(field("แม่แบบ"), { target: { value: "invoice" } });
  fireEvent.click(button());

  expect(await within(preview()).findByRole("article", { name: "ใบแจ้งหนี้" })).toBeInTheDocument();
});

test.each(["010556000000", "01055600000012", "01055600000AB"])("[TC-HDR-025] a tax id of %s is not sent: the card says 13 digits", async (taxId) => {
  await sendShopText();

  fireEvent.change(field("เลขประจำตัวผู้เสียภาษี"), { target: { value: taxId } });
  fireEvent.click(button());

  expect(await screen.findByText("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก")).toBeInTheDocument();
  expect(server.posted).toEqual([]);
  expect(field("เลขประจำตัวผู้เสียภาษี")).toBeInvalid();
});

test("[TC-HDR-025] 13 digits with a wrong check digit is sent, with a warning on the card", async () => {
  await sendShopText();

  fireEvent.change(field("เลขประจำตัวผู้เสียภาษี"), { target: { value: "0105560000001" } });

  expect(screen.getByText(/หลักที่ 13 ไม่ตรงกับการคำนวณ/)).toBeInTheDocument();
  fireEvent.click(button());
  await waitFor(() => expect(server.posted).toHaveLength(1));
});

test("[FR-HDR-080] an empty shop name is not sent", async () => {
  await sendShopText();

  fireEvent.change(field("ชื่อร้าน"), { target: { value: "" } });
  fireEvent.click(button());

  expect(await screen.findByText("ใส่ชื่อร้านก่อนใช้หัวบิล")).toBeInTheDocument();
  expect(server.posted).toEqual([]);
});

test("[review] a refusal from the server shows its text under the field and keeps the card", async () => {
  server.shopStatus = 400;
  server.shopBody = { error: "ตรวจช่องที่ขีดแดงก่อนใช้หัวบิล", fields: { address: "ยาวเกิน 500 ตัวอักษร" } };
  await sendShopText();

  fireEvent.click(button());

  expect(await screen.findByText("ยาวเกิน 500 ตัวอักษร")).toBeInTheDocument();
  expect(button()).toBeEnabled();
});

test("[review] a server failure says so in Thai, keeps what the user typed, and the bill has no shop", async () => {
  server.shopStatus = 500;
  server.shopBody = { error: "ใช้หัวบิลไม่สำเร็จ ลองอีกครั้ง" };
  await sendShopText();

  fireEvent.click(button());

  expect(await screen.findByText("ใช้หัวบิลไม่สำเร็จ ลองอีกครั้ง")).toBeInTheDocument();
  expect(field("ชื่อร้าน")).toHaveValue("ร้านกาแฟบ้านสวน");
  expect(within(preview()).queryByRole("article")).toBeNull();
});

test("[TC-HDR-021] a message with no shop info shows the hint and no card", async () => {
  server.cardFor = null;

  await sendShopText();

  expect(screen.getByText(/ยังไม่มีหัวบิล เริ่มจากพิมพ์ข้อมูลร้านในแชต/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ใช้หัวบิลนี้" })).toBeNull();
  expect(within(preview()).queryByRole("article")).toBeNull();
});

test("[review] text a user typed with HTML in the shop name shows as text on the bill", async () => {
  server.cardFor = { ...cashShop, shopName: "<img src=x onerror=alert(1)>" };
  await sendShopText();

  fireEvent.click(button());

  expect(await within(preview()).findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  expect(preview().querySelector("img")).toBeNull();
});

test("[FR-CHAT-030] a message that also held items is sent again once, after the shop is set", async () => {
  server.hasBill = true;
  await sendShopText();
  expect(screen.getByText(/ระบบจะทำรายการในข้อความเดิมต่อให้/)).toBeInTheDocument();

  fireEvent.click(button());

  await waitFor(() => expect(server.messages).toEqual([TEXT, TEXT]));
  expect(server.posted).toHaveLength(1);
});

test("[FR-CHAT-030] a message with no items is not sent again, and the card does not promise it", async () => {
  await sendShopText();
  expect(screen.queryByText(/ระบบจะทำรายการในข้อความเดิมต่อให้/)).toBeNull();

  fireEvent.click(button());

  await within(preview()).findByText("ร้านกาแฟบ้านสวน");
  expect(server.messages).toEqual([TEXT]);
});

test("[FR-CHAT-030] the sending again fails: the shop stays set, the failure shows as usual, and the shop is not set twice", async () => {
  server.hasBill = true;
  server.failSecondMessage = true;
  await sendShopText();

  fireEvent.click(button());

  expect(await screen.findByText("ส่งข้อความไม่สำเร็จ ลองอีกครั้ง")).toBeInTheDocument();
  expect(within(preview()).getByText("ร้านกาแฟบ้านสวน")).toBeInTheDocument();
  expect(server.posted).toHaveLength(1);
});

test("[review] the user opens another chat while the shop is being saved: that screen does not change and nothing is sent again", async () => {
  server.hasBill = true;
  let release: () => void = () => undefined;
  server.holdShop = new Promise<void>((resolve) => (release = resolve));
  await sendShopText();

  fireEvent.click(button());
  await waitFor(() => expect(server.posted).toHaveLength(1));
  fireEvent.click(await screen.findByRole("button", { name: "แชตอื่น" }));
  await screen.findByText("ของแชตอื่น");
  release();
  await new Promise((resolve) => setTimeout(resolve, 200));

  expect(screen.getByText("ของแชตอื่น")).toBeInTheDocument();
  expect(screen.queryByText("ใช้หัวบิลนี้แล้ว พิมพ์รายการสินค้าต่อได้เลย")).toBeNull();
  expect(within(preview()).queryByText("ร้านกาแฟบ้านสวน")).toBeNull();
  expect(server.messages).toEqual([TEXT]);
});

test("[review] what the user starts to type while the shop is being saved is still in the box after the text is sent again", async () => {
  server.hasBill = true;
  let release: () => void = () => undefined;
  server.holdShop = new Promise<void>((resolve) => (release = resolve));
  await sendShopText();

  fireEvent.click(button());
  await waitFor(() => expect(server.posted).toHaveLength(1));
  fireEvent.change(screen.getByRole("textbox", { name: "ข้อความ" }), { target: { value: "กำลังพิมพ์ต่อ" } });
  release();

  await waitFor(() => expect(server.messages).toEqual([TEXT, TEXT]));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "ข้อความ" })).toBeEnabled());
  expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("กำลังพิมพ์ต่อ");
});
