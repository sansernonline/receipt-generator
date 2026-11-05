import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const row = (id: string, title: string, customerName: string | null, billNumber: string | null) => ({ id, title, updatedAt: "2026-10-18T04:00:00Z", customerName, billNumber });
const ROWS = [
  row("11111111-1111-4111-8111-111111111111", "แชตแรก", "สมชาย ใจดี", "RC-2569-0042"),
  row("22222222-2222-4222-8222-222222222222", "แชตสอง", "สมหญิง รักดี", "RC-2569-0043"),
  row("33333333-3333-4333-8333-333333333333", "แชตสาม", null, null),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T05:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ chats: ROWS })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const list = () => screen.getByRole("navigation", { name: "รายการแชต" });
const titlesShown = () => within(list()).queryAllByRole("listitem").map((item) => item.textContent);

async function renderListed() {
  render(<ChatShell />);
  await within(list()).findByText("วันนี้ (3)");
  return screen.getByRole("searchbox", { name: "ค้นหาแชต" });
}

test("[TC-CHAT-023] typing a customer name shows only that chat and the group count follows", async () => {
  const box = await renderListed();

  fireEvent.change(box, { target: { value: "สมชาย" } });

  expect(titlesShown()).toEqual(["แชตแรก"]);
  expect(within(list()).getByText("วันนี้ (1)")).toBeInTheDocument();
});

test("[TC-CHAT-024] typing a bill number shows only that chat", async () => {
  const box = await renderListed();

  fireEvent.change(box, { target: { value: "RC-2569-0042" } });

  expect(titlesShown()).toEqual(["แชตแรก"]);
});

test("[TC-CHAT-025] no match shows a not-found message that names the query, not the first-time empty text", async () => {
  const box = await renderListed();

  fireEvent.change(box, { target: { value: "ไม่มีคำนี้" } });

  expect(titlesShown()).toEqual([]);
  expect(within(list()).getByRole("status")).toHaveTextContent("ไม่พบแชตที่มี “ไม่มีคำนี้”");
  expect(within(list()).queryByText("ยังไม่มีแชต")).toBeNull();
});

test.each([".*", "(", "["])("[TC-CHAT-025] the text %j finds nothing and the page stays up", async (query) => {
  const box = await renderListed();

  fireEvent.change(box, { target: { value: query } });

  expect(titlesShown()).toEqual([]);
  expect(within(list()).getByRole("status")).toHaveTextContent(`ไม่พบแชตที่มี “${query}”`);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the clear button empties the box and brings every chat back", async () => {
  const box = await renderListed();
  fireEvent.change(box, { target: { value: "ไม่มีคำนี้" } });

  fireEvent.click(within(list()).getByRole("button", { name: "ล้างคำค้น" }));

  expect(box).toHaveValue("");
  expect(titlesShown()).toEqual(["แชตแรก", "แชตสอง", "แชตสาม"]);
});

test("the query is shown as text, never as HTML", async () => {
  const box = await renderListed();

  fireEvent.change(box, { target: { value: "<img src=x onerror=alert(1)>" } });

  expect(list().querySelector("img")).toBeNull();
  expect(within(list()).getByRole("status")).toHaveTextContent("<img src=x onerror=alert(1)>");
});

test("a chat that is open stays open while the search hides it from the list", async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    String(url).endsWith(ROWS[0].id)
      ? Response.json({ chat: { ...ROWS[0], shopId: null, messages: [{ role: "user", text: "ข้อความในแชตแรก" }] }, draft: { items: [], bill: { customerName: null, billNumber: null } } })
      : Response.json({ chats: ROWS }),
  );
  const box = await renderListed();
  fireEvent.click(within(list()).getByRole("button", { name: "แชตแรก" }));
  await screen.findByText("ข้อความในแชตแรก");

  fireEvent.change(box, { target: { value: "สมหญิง" } });

  expect(titlesShown()).toEqual(["แชตสอง"]);
  expect(screen.getByText("ข้อความในแชตแรก")).toBeInTheDocument();
});
