import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const created = { id: "22222222-2222-4222-8222-222222222222", title: "แชตใหม่", updatedAt: "2026-10-18T05:00:00Z" };
const userMessage = { role: "user", text: "สวัสดี", createdAt: "2026-10-18T05:00:00Z" };
let consentStatus: number;
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  consentStatus = 201;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url === "/api/consent") return new Response("{}", { status: consentStatus });
      if (url.endsWith("/messages")) return Response.json({ chat: created, message: userMessage, messages: [userMessage], draft: {}, totals: {}, notices: [] }, { status: 201 });
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

const sends = () => calls.filter((call) => call.endsWith("/messages"));
const consents = () => calls.filter((call) => call === "POST /api/consent");
const dialog = () => screen.getByRole("dialog", { name: "ก่อนส่งข้อมูลให้ AI" });
const box = () => screen.getByRole("textbox", { name: "ข้อความ" });

async function sendText(text: string) {
  await screen.findByText("ยังไม่มีแชต");
  fireEvent.change(box(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "ส่ง" }));
}

test("[TC-NFR-019] the first send shows the AI notice and sends nothing until the user accepts", async () => {
  render(<ChatShell />);

  await sendText("สวัสดี");

  expect(dialog()).toHaveTextContent("Typhoon");
  expect(sends()).toEqual([]);
});

test("[TC-NFR-019] accepting records the acknowledgement and then sends the message once", async () => {
  render(<ChatShell />);
  await sendText("สวัสดี");

  fireEvent.click(within(dialog()).getByRole("button", { name: "รับทราบและส่งต่อ" }));

  await waitFor(() => expect(sends()).toHaveLength(1));
  expect(consents()).toHaveLength(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("[TC-NFR-019] the second message in the same browser shows no notice", async () => {
  render(<ChatShell />);
  await sendText("สวัสดี");
  fireEvent.click(within(dialog()).getByRole("button", { name: "รับทราบและส่งต่อ" }));
  await waitFor(() => expect(box()).toBeEnabled());
  await waitFor(() => expect(sends()).toHaveLength(1));

  fireEvent.change(box(), { target: { value: "ข้อความที่สอง" } });
  fireEvent.click(screen.getByRole("button", { name: "ส่ง" }));

  await waitFor(() => expect(sends()).toHaveLength(2));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(consents()).toHaveLength(1);
});

test("cancelling the notice sends nothing and keeps the typed text", async () => {
  render(<ChatShell />);
  await sendText("สวัสดี");

  fireEvent.click(within(dialog()).getByRole("button", { name: "ยกเลิก" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(sends()).toEqual([]);
  expect(box()).toHaveValue("สวัสดี");
});

test("when the acknowledgement cannot be saved nothing is sent and the notice stays with a Thai error", async () => {
  consentStatus = 500;
  render(<ChatShell />);
  await sendText("สวัสดี");

  fireEvent.click(within(dialog()).getByRole("button", { name: "รับทราบและส่งต่อ" }));

  expect(await within(dialog()).findByRole("alert")).toHaveTextContent("บันทึกการรับทราบไม่สำเร็จ");
  expect(sends()).toEqual([]);
});

test("while the acknowledgement is being saved the notice cannot be cancelled, so it cannot send after a cancel", async () => {
  let finishConsent: (res: Response) => void = () => undefined;
  const base = vi.mocked(fetch).getMockImplementation()!;
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => (url === "/api/consent" ? new Promise<Response>((resolve) => (finishConsent = resolve)) : base(url, init))));
  render(<ChatShell />);
  await sendText("สวัสดี");
  fireEvent.click(within(dialog()).getByRole("button", { name: "รับทราบและส่งต่อ" }));

  fireEvent.keyDown(document, { key: "Escape" });

  expect(within(dialog()).getByRole("button", { name: "ยกเลิก" })).toBeDisabled();
  expect(sends()).toEqual([]);
  finishConsent(new Response("{}", { status: 201 }));
  await waitFor(() => expect(sends()).toHaveLength(1));
});

test("when saving the acknowledgement hangs, after 10 seconds the notice works again and nothing is sent", async () => {
  const base = vi.mocked(fetch).getMockImplementation()!;
  const hangs = (init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => (url === "/api/consent" ? hangs(init) : base(url, init))));
  render(<ChatShell />);
  await sendText("สวัสดี");
  vi.useFakeTimers();
  fireEvent.click(within(dialog()).getByRole("button", { name: "รับทราบและส่งต่อ" }));

  await act(() => vi.advanceTimersByTimeAsync(9_000));
  expect(within(dialog()).getByRole("button", { name: "ยกเลิก" })).toBeDisabled();
  await act(() => vi.advanceTimersByTimeAsync(2_000));

  expect(within(dialog()).getByRole("alert")).toHaveTextContent("บันทึกการรับทราบไม่สำเร็จ");
  expect(within(dialog()).getByRole("button", { name: "ยกเลิก" })).toBeEnabled();
  expect(within(dialog()).getByRole("button", { name: "รับทราบและส่งต่อ" })).toBeEnabled();
  expect(sends()).toEqual([]);
  vi.useRealTimers();
});
