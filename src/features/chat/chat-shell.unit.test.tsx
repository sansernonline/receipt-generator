import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const existing = { id: "11111111-1111-4111-8111-111111111111", title: "ออกบิลร้านกาแฟ", updatedAt: "2026-10-18T04:00:00Z" };
const created = { id: "22222222-2222-4222-8222-222222222222", title: "แชตใหม่", updatedAt: "2026-10-18T05:00:00Z" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T05:00:00Z")); // 18 Oct 2569 12:00 Bangkok
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({ chat: created }, { status: 201 })
        : Response.json({ chats: [existing] }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("[TC-CHAT-003] one click on new chat puts an empty chat on top of today, count 1 to 2", async () => {
  render(<ChatShell />);
  const list = await screen.findByRole("navigation", { name: "รายการแชต" });
  await within(list).findByText("วันนี้ (1)");

  fireEvent.click(screen.getByRole("button", { name: "แชตใหม่" }));

  await within(list).findByText("วันนี้ (2)");
  expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["แชตใหม่", "ออกบิลร้านกาแฟ"]);
  expect(screen.getByRole("heading", { level: 1, name: "แชตใหม่" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("");
});

test("shows the empty hint when there are no chats yet", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ chats: [] }));

  render(<ChatShell />);

  expect(await screen.findByText("ยังไม่มีแชต")).toBeInTheDocument();
});

test("shows a short Thai error under the button when the server refuses to create a chat", async () => {
  render(<ChatShell />);
  await screen.findByText("วันนี้ (1)");
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "boom" }, { status: 500 }));

  fireEvent.click(screen.getByRole("button", { name: "แชตใหม่" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("สร้างแชตไม่สำเร็จ ลองอีกครั้ง");
  expect(screen.getByRole("button", { name: "แชตใหม่" })).toBeEnabled();
});

test("shows the same error when the network fails, without the raw error message", async () => {
  render(<ChatShell />);
  await screen.findByText("วันนี้ (1)");
  vi.mocked(fetch).mockRejectedValueOnce(new Error("socket hang up"));

  fireEvent.click(screen.getByRole("button", { name: "แชตใหม่" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("สร้างแชตไม่สำเร็จ ลองอีกครั้ง");
  expect(alert).not.toHaveTextContent("socket");
});

test.each([
  ["network failure", () => vi.mocked(fetch).mockRejectedValueOnce(new Error("down"))],
  ["bad shape", () => vi.mocked(fetch).mockResolvedValueOnce(Response.json({ nope: 1 }))],
  ["server error", () => vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 500 }))],
])("says the list cannot be loaded on %s, not that there are no chats", async (_name, arrange) => {
  arrange();

  render(<ChatShell />);

  expect(await screen.findByText("โหลดรายการแชตไม่ได้")).toBeInTheDocument();
  expect(screen.queryByText("ยังไม่มีแชต")).not.toBeInTheDocument();
});
