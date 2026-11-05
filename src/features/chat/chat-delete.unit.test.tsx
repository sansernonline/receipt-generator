import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const rows = [
  { id: ID, title: "บิลของลูกค้า", updatedAt: "2026-10-18T04:00:00Z" },
  { id: OTHER, title: "แชตอื่น", updatedAt: "2026-10-18T03:00:00Z" },
];
const detail = { chat: { ...rows[0], shopId: null, messages: [{ role: "user", text: "บรรทัดหนึ่ง" }, { role: "user", text: "บรรทัดสอง" }] }, draft: { items: [], bill: { customerName: null, billNumber: null } } };
let answerDelete: () => Response | Promise<Response>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-18T05:00:00Z"));
  answerDelete = () => new Response(null, { status: 204 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return answerDelete();
      return url.endsWith(ID) ? Response.json(detail) : Response.json({ chats: rows });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const deleteCalls = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "DELETE");
const list = () => screen.getByRole("navigation", { name: "รายการแชต" });

async function openDeleteDialog() {
  render(<ChatShell />);
  fireEvent.click(await screen.findByRole("button", { name: "บิลของลูกค้า" }));
  await screen.findByText("บรรทัดสอง");
  fireEvent.click(screen.getByRole("button", { name: "เมนูแชต" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "ลบแชต" }));
  return screen.getByRole("dialog", { name: "ลบแชตนี้?" });
}

test("the delete box names the chat and says it cannot be undone and when the data goes", async () => {
  const dialog = await openDeleteDialog();

  expect(dialog).toHaveTextContent("บิลของลูกค้า");
  expect(dialog).toHaveTextContent("กู้คืนไม่ได้");
  expect(dialog).toHaveTextContent("ภายใน 1 นาที");
  expect(deleteCalls()).toHaveLength(0);
});

test("[TC-CHAT-019] confirming sends one DELETE, removes the chat from the list and leaves the other one", async () => {
  const dialog = await openDeleteDialog();

  fireEvent.click(within(dialog).getByRole("button", { name: "ลบแชต" }));

  await waitFor(() => expect(within(list()).queryByText("บิลของลูกค้า")).toBeNull());
  expect(within(list()).getAllByRole("listitem")).toHaveLength(1);
  expect(within(list()).getByText("แชตอื่น")).toBeInTheDocument();
  expect(deleteCalls().map(([url]) => url)).toEqual([`/api/chats/${ID}`]);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("แชตใหม่");
  expect(screen.queryByText("บรรทัดสอง")).toBeNull();
});

test("[TC-CHAT-021] cancel closes the box, sends nothing and keeps the chat with its messages", async () => {
  const dialog = await openDeleteDialog();

  fireEvent.click(within(dialog).getByRole("button", { name: "ยกเลิก" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(deleteCalls()).toHaveLength(0);
  expect(within(list()).getByText("บิลของลูกค้า")).toBeInTheDocument();
  expect(screen.getByText("บรรทัดหนึ่ง")).toBeInTheDocument();
  expect(screen.getByText("บรรทัดสอง")).toBeInTheDocument();
});

test("Escape and a click on the dark area cancel too", async () => {
  await openDeleteDialog();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "เมนูแชต" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "ลบแชต" }));
  fireEvent.click(screen.getByRole("dialog", { name: "ลบแชตนี้?" }).parentElement!);

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(deleteCalls()).toHaveLength(0);
});

test("the cancel button has the focus when the box opens, so Enter does not delete", async () => {
  const dialog = await openDeleteDialog();

  expect(within(dialog).getByRole("button", { name: "ยกเลิก" })).toHaveFocus();
});

test("a failed delete keeps the box and the chat and shows the message", async () => {
  answerDelete = () => Response.json({ error: "ลบแชตไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
  const dialog = await openDeleteDialog();

  fireEvent.click(within(dialog).getByRole("button", { name: "ลบแชต" }));

  expect(await within(dialog).findByRole("alert")).toHaveTextContent("ลบแชตไม่สำเร็จ ลองอีกครั้ง");
  expect(within(list()).getByText("บิลของลูกค้า")).toBeInTheDocument();
});

test("a second click while the delete is running sends no second request", async () => {
  let finish: (res: Response) => void = () => undefined;
  answerDelete = () => new Promise<Response>((resolve) => (finish = resolve));
  const dialog = await openDeleteDialog();
  const confirm = within(dialog).getByRole("button", { name: "ลบแชต" });

  fireEvent.click(confirm);
  fireEvent.click(confirm);
  finish(new Response(null, { status: 204 }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(deleteCalls()).toHaveLength(1);
});
