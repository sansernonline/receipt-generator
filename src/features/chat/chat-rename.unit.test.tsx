import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const ID = "11111111-1111-4111-8111-111111111111";
const row = { id: ID, title: "บิล 1", updatedAt: "2026-10-18T04:00:00Z" };
const detail = { chat: { ...row, shopId: null, messages: [] }, draft: { items: [], bill: { customerName: null, billNumber: null } } };
let patchTitle: (title: string) => Response;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T05:00:00Z"));
  patchTitle = (title) => Response.json({ chat: { ...row, title, updatedAt: "2026-10-18T05:00:00Z" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return patchTitle(JSON.parse(String(init.body)).title);
      return url.endsWith(ID) ? Response.json(detail) : Response.json({ chats: [row] });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openRenameDialog() {
  render(<ChatShell />);
  fireEvent.click(await screen.findByRole("button", { name: "บิล 1" }));
  fireEvent.click(await screen.findByRole("button", { name: "เมนูแชต" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "เปลี่ยนชื่อแชต" }));
  return screen.getByRole("dialog", { name: "เปลี่ยนชื่อแชต" });
}

const typeName = (dialog: HTMLElement, value: string) => fireEvent.change(within(dialog).getByRole("textbox", { name: "ชื่อแชต" }), { target: { value } });
const list = () => screen.getByRole("navigation", { name: "รายการแชต" });

test("[TC-CHAT-015] renaming shows the new name in the list and in the header, and closes the box", async () => {
  const dialog = await openRenameDialog();

  typeName(dialog, "บิลคุณสมชาย");
  fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกชื่อ" }));

  await waitFor(() => expect(within(list()).getByText("บิลคุณสมชาย")).toBeInTheDocument());
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("บิลคุณสมชาย");
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the box starts with the current name and shows the count", async () => {
  const dialog = await openRenameDialog();

  expect(within(dialog).getByRole("textbox", { name: "ชื่อแชต" })).toHaveValue("บิล 1");
  expect(within(dialog).getByText("4/80 ตัวอักษร")).toBeInTheDocument();
});

test("[TC-CHAT-017] 81 characters: the reason shows, save is blocked, nothing is sent", async () => {
  const dialog = await openRenameDialog();

  typeName(dialog, "ก".repeat(81));
  fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกชื่อ" }));

  expect(within(dialog).getByText("ชื่อยาวได้ไม่เกิน 80 ตัวอักษร")).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});

test("[TC-CHAT-018] a blank name shows the reason and nothing is sent", async () => {
  const dialog = await openRenameDialog();

  typeName(dialog, "   ");
  fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกชื่อ" }));

  expect(within(dialog).getByText("ใส่ชื่ออย่างน้อย 1 ตัวอักษร")).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});

test("cancel closes the box and keeps the name", async () => {
  const dialog = await openRenameDialog();

  typeName(dialog, "อย่างอื่น");
  fireEvent.click(within(dialog).getByRole("button", { name: "ยกเลิก" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(within(list()).getByText("บิล 1")).toBeInTheDocument();
});

test("Escape closes the box", async () => {
  await openRenameDialog();

  fireEvent.keyDown(document, { key: "Escape" });

  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a server refusal keeps the box open and shows a message", async () => {
  patchTitle = () => Response.json({ error: "ชื่อยาวได้ไม่เกิน 80 ตัวอักษร" }, { status: 400 });
  const dialog = await openRenameDialog();

  typeName(dialog, "ชื่อใหม่");
  fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกชื่อ" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("ชื่อยาวได้ไม่เกิน 80 ตัวอักษร");
});

test("a HTML name stays as text", async () => {
  patchTitle = (title) => Response.json({ chat: { ...row, title } });
  const dialog = await openRenameDialog();

  typeName(dialog, "<img src=x onerror=alert(1)>");
  fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกชื่อ" }));

  await waitFor(() => expect(within(list()).getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument());
  expect(list().querySelector("img")).toBeNull();
});
