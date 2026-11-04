import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const HTML_TEXT = "<script>alert(1)</script> ร้านกาแฟ";
const created = { id: "22222222-2222-4222-8222-222222222222", title: "แชตใหม่", updatedAt: "2026-10-18T05:00:00Z" };
const sent = { ...created, title: HTML_TEXT, updatedAt: "2026-10-18T05:01:00Z" };
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/messages")) return Response.json({ chat: sent, message: { role: "user", text: HTML_TEXT } }, { status: 201 });
      if (init?.method === "POST") return Response.json({ chat: created }, { status: 201 });
      return Response.json({ chats: [] });
    }),
  );
});

afterEach(() => {
  cleanup();
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

  fireEvent.click(screen.getByRole("button", { name: "แชตใหม่" }));

  await waitFor(() => expect(screen.getByRole("textbox", { name: "ข้อความ" })).toBeEnabled());
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
});
