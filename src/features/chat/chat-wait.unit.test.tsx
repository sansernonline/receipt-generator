import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { acknowledgeAiNotice } from "../consent/ai-notice-flag";
import { ChatShell } from "./chat-shell";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const otherRow = { id: OTHER, title: "บิลชา", updatedAt: "2026-10-18T03:00:00Z" };
const row = { id: ID, title: "บิลกาแฟ", updatedAt: "2026-10-18T04:00:00Z" };
const detail = { chat: { ...row, shopId: null, messages: [] }, draft: { items: [], bill: { customerName: null, billNumber: null } } };
const userMessage = { role: "user", text: "กาแฟเย็น 3 แก้ว 55 บาท", createdAt: "2026-10-18T05:00:00Z" };
const aiMessage = { role: "assistant", text: "เพิ่มกาแฟเย็น 3 แก้วแล้ว", createdAt: "2026-10-18T05:00:05Z" };
const aiDownNotice = "AI ยังไม่ตอบ ร่างบิลยังเหมือนเดิม ลองส่งอีกครั้ง";

let answerSend: (init: RequestInit) => Promise<Response>;

beforeEach(() => {
  acknowledgeAiNotice();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/messages")) return answerSend(init ?? {});
      if (url.endsWith(OTHER)) return Response.json({ ...detail, chat: { ...detail.chat, ...otherRow } });
      return url.endsWith(ID) ? Response.json(detail) : Response.json({ chats: [row, otherRow] });
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const box = () => screen.getByRole("textbox", { name: "ข้อความ" });

async function openChat() {
  render(<ChatShell />);
  fireEvent.click(await screen.findByRole("button", { name: "บิลกาแฟ" }));
  await screen.findByRole("heading", { name: "บิลกาแฟ" });
}

function send(text: string) {
  fireEvent.change(box(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "ส่ง" }));
}

async function sendInOpenChat(text: string) {
  await openChat();
  send(text);
}

const answered = (over: object) => Response.json({ chat: row, message: userMessage, messages: [userMessage], draft: {}, totals: {}, notices: [], ...over }, { status: 201 });
const neverAnswers = (init: RequestInit) => new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));

test("[TC-CHAT-028] a waiting status shows at once, the box is closed, and both go when the reply and notices appear", async () => {
  let answer: (res: Response) => void = () => undefined;
  answerSend = () => new Promise((resolve) => (answer = resolve));

  await sendInOpenChat(userMessage.text);

  expect(await screen.findByText("กำลังทำ…")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("กำลังทำ");
  expect(box()).toBeDisabled();
  answer(answered({ messages: [userMessage, aiMessage], notices: ["ยอดรวมเปลี่ยนจาก 295.00 → 460.00 บาท"] }));
  await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
  expect(screen.getByText(aiMessage.text)).toBeInTheDocument();
  expect(screen.getByText("ยอดรวมเปลี่ยนจาก 295.00 → 460.00 บาท")).toBeInTheDocument();
  expect(box()).toBeEnabled();
});

test("[TC-CHAT-029] when the AI fails the status goes, the Thai notice shows and the box works again", async () => {
  answerSend = async () => answered({ notices: [aiDownNotice], error: "server_error" });

  await sendInOpenChat("เพิ่มน้ำเปล่า 1 ขวด 10");

  expect(await screen.findByText(aiDownNotice)).toBeInTheDocument();
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(box()).toBeEnabled();
});

test("[TC-CHAT-029] when the request itself fails the status goes and the typed text comes back", async () => {
  answerSend = async () => new Response("{}", { status: 500 });

  await sendInOpenChat("เพิ่มน้ำเปล่า 1 ขวด 10");

  expect(await screen.findByRole("alert")).toHaveTextContent("ส่งข้อความไม่สำเร็จ");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(box()).toHaveValue("เพิ่มน้ำเปล่า 1 ขวด 10");
});

test("[TC-CHAT-037] after 64 seconds the box is still closed; after 66 it opens with a Thai message that does not promise the draft is unchanged", async () => {
  answerSend = neverAnswers;
  await openChat();
  vi.useFakeTimers(); // installed before sending: the 60 second timer is made by the send
  send(userMessage.text);
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("status")).toHaveTextContent("กำลังทำ");

  await act(() => vi.advanceTimersByTimeAsync(64_000));
  expect(box()).toBeDisabled();
  await act(() => vi.advanceTimersByTimeAsync(2_000));

  expect(box()).toBeEnabled();
  expect(screen.getByRole("alert")).toHaveTextContent("ยังไม่ได้รับคำตอบ");
  expect(screen.getByRole("alert")).not.toHaveTextContent("ยังเหมือนเดิม");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

test("a reply that comes after the user opened another chat does not touch that chat's screen", async () => {
  let answer: (res: Response) => void = () => undefined;
  answerSend = () => new Promise((resolve) => (answer = resolve));
  await sendInOpenChat(userMessage.text);
  await screen.findByText("กำลังทำ…");

  fireEvent.click(screen.getByRole("button", { name: "บิลชา" }));
  await screen.findByRole("heading", { name: "บิลชา" });
  answer(answered({ messages: [userMessage, aiMessage] }));
  await waitFor(() => expect(box()).toBeEnabled());

  expect(screen.queryByText(aiMessage.text)).toBeNull();
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(box()).toHaveValue("");
});

test("a failure that comes after the user opened another chat leaves that chat's box empty and shows no error", async () => {
  let answer: (res: Response) => void = () => undefined;
  answerSend = () => new Promise((resolve) => (answer = resolve));
  await sendInOpenChat(userMessage.text);
  await screen.findByText("กำลังทำ…");

  fireEvent.click(screen.getByRole("button", { name: "บิลชา" }));
  await screen.findByRole("heading", { name: "บิลชา" });
  answer(new Response("{}", { status: 500 }));
  await waitFor(() => expect(box()).toBeEnabled());

  expect(box()).toHaveValue("");
  expect(screen.queryByText(/ส่งข้อความไม่สำเร็จ/)).toBeNull();
});
