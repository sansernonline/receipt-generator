import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { acknowledgeAiNotice } from "../consent/ai-notice-flag";
import { ChatShell } from "./chat-shell";

const HTML_TEXT = "<script>alert(1)</script> ร้านกาแฟ";
const created = { id: "22222222-2222-4222-8222-222222222222", title: "แชตใหม่", updatedAt: "2026-10-18T05:00:00Z" };
const sent = { ...created, title: HTML_TEXT, updatedAt: "2026-10-18T05:01:00Z" };
const calls: string[] = [];

beforeEach(() => {
  acknowledgeAiNotice(); // these tests are about sending, not the first-time notice (chat-consent.unit.test.tsx)
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/messages")) return Response.json({ chat: sent, message: { role: "user", text: HTML_TEXT }, messages: [{ role: "user", text: HTML_TEXT }], notices: [] }, { status: 201 });
      if (init?.method === "POST") return Response.json({ chat: created }, { status: 201 });
      return Response.json({ chats: [] });
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function sendText(text: string) {
  await screen.findByText("ยังไม่มีแชต");
  fireEvent.change(screen.getByRole("textbox", { name: "ข้อความ" }), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "ส่ง" }));
}

test("[TC-CHAT-008] HTML in the first message shows as plain text in the list and the conversation", async () => {
  const { container } = render(<ChatShell />);

  await sendText(HTML_TEXT);

  const list = screen.getByRole("navigation", { name: "รายการแชต" });
  await within(list).findByText(HTML_TEXT);
  expect(within(screen.getByRole("region", { name: "บทสนทนา" })).getByText(HTML_TEXT)).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
});

test("sending with no chat open creates the chat first, then posts the message and clears the box", async () => {
  render(<ChatShell />);

  await sendText("สวัสดี");

  await waitFor(() => expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue(""));
  expect(calls.slice(1)).toEqual(["POST /api/chats", `POST /api/chats/${created.id}/messages`]);
});

test("the send button stays disabled while the box is empty", async () => {
  render(<ChatShell />);
  await screen.findByText("ยังไม่มีแชต");

  expect(screen.getByRole("button", { name: "ส่ง" })).toBeDisabled();
});

test("shows a Thai error and keeps the text when sending fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? new Response("{}", { status: 500 }) : Response.json({ chats: [] }))));
  render(<ChatShell />);

  await sendText("สวัสดี");

  expect(await screen.findByRole("alert")).toHaveTextContent("ส่งข้อความไม่สำเร็จ ลองอีกครั้ง");
  expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("สวัสดี");
});

test("a chat that is already in the loaded list is not listed twice after it is created", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => (init?.method === "POST" ? Response.json({ chat: created }, { status: 201 }) : Response.json({ chats: [created] }))));
  render(<ChatShell />);
  const list = screen.getByRole("navigation", { name: "รายการแชต" });
  await within(list).findByRole("listitem");

  fireEvent.click(screen.getAllByRole("button", { name: "แชตใหม่" })[0]); // the list holds a chat with the same title; the new chat button comes first

  await waitFor(() => expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue(""));
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
});

test("text typed while a message is still sending stays in the box", async () => {
  let finish: (res: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => (finish = resolve));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => (url.endsWith("/messages") ? pending : init?.method === "POST" ? Response.json({ chat: created }, { status: 201 }) : Response.json({ chats: [] }))));
  render(<ChatShell />);
  await sendText("แรก");
  await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));

  fireEvent.change(screen.getByRole("textbox", { name: "ข้อความ" }), { target: { value: "พิมพ์ต่อ" } });
  finish(Response.json({ chat: sent, message: { role: "user", text: "แรก" }, messages: [{ role: "user", text: "แรก" }], notices: [] }, { status: 201 }));

  await screen.findByText("แรก", { selector: "p" });
  expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("พิมพ์ต่อ");
});

test("when the chat is created but the message fails, the typed text comes back in the box", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => (url.endsWith("/messages") ? new Response("{}", { status: 500 }) : init?.method === "POST" ? Response.json({ chat: created }, { status: 201 }) : Response.json({ chats: [] }))));
  render(<ChatShell />);

  await sendText("ข้อความแรกที่พิมพ์");

  expect(await screen.findByRole("alert")).toHaveTextContent("ส่งข้อความไม่สำเร็จ");
  expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("ข้อความแรกที่พิมพ์");
});

test("Enter sends the message, like the send button", async () => {
  render(<ChatShell />);
  await screen.findByText("ยังไม่มีแชต");
  const box = screen.getByRole("textbox", { name: "ข้อความ" });
  fireEvent.change(box, { target: { value: "สวัสดี" } });

  fireEvent.keyDown(box, { key: "Enter" });

  await waitFor(() => expect(calls).toContain(`POST /api/chats/${created.id}/messages`));
});

test("Shift+Enter and Enter while composing Thai text do not send", async () => {
  render(<ChatShell />);
  await screen.findByText("ยังไม่มีแชต");
  const box = screen.getByRole("textbox", { name: "ข้อความ" });
  fireEvent.change(box, { target: { value: "สวัสดี" } });

  fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
  fireEvent.keyDown(box, { key: "Enter", isComposing: true });

  expect(calls).toEqual(["GET /api/chats"]);
});
