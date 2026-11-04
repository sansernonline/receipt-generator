import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatShell } from "./chat-shell";

const NOW = new Date("2026-10-18T05:00:00Z"); // 18 Oct 2569 12:00 Bangkok
const chat = (id: string, title: string, updatedAt: string, isStale = false) => ({ id, title, updatedAt, isStale });
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

// today x2, yesterday x1, 10 days ago x1 — in the order the server sends them (newest edit first)
const FOUR = [
  chat(A, "แชตวันนี้ล่าสุด", "2026-10-18T04:00:00Z"),
  chat(B, "แชตวันนี้เก่ากว่า", "2026-10-18T01:00:00Z"),
  chat("33333333-3333-4333-8333-333333333333", "แชตเมื่อวาน", "2026-10-17T05:00:00Z"),
  chat("44444444-4444-4444-8444-444444444444", "แชตสิบวันก่อน", "2026-10-08T05:00:00Z"),
];
const detail = (id: string, title: string, messages: string[]) => ({
  chat: { id, title, updatedAt: "2026-10-18T04:00:00Z", shopId: null, messages: messages.map((text) => ({ role: "user", text })) },
  draft: { items: [], bill: { customerName: null, billNumber: null } },
});

function stubServer(chats: unknown[], open: (id: string) => Response = () => new Response("{}", { status: 500 })) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (/\/api\/chats\/[^/]+$/.test(url) ? open(url.split("/").pop()!) : Response.json({ chats }))),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const listNav = () => screen.getByRole("navigation", { name: "รายการแชต" });

test("[TC-CHAT-009] the list shows วันนี้ 2 · เมื่อวาน 1 · ก่อนหน้า 1 in that order, newest edit first inside today", async () => {
  stubServer(FOUR);
  render(<ChatShell />);

  await within(listNav()).findByText("วันนี้ (2)");

  expect(within(listNav()).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["วันนี้ (2)", "เมื่อวาน (1)", "ก่อนหน้า (1)"]);
  expect(within(listNav()).getAllByRole("listitem")[0]).toHaveTextContent("แชตวันนี้ล่าสุด");
});

test("[TC-CHAT-011] no chats at all: no group heading, no error message", async () => {
  stubServer([]);
  render(<ChatShell />);

  await within(listNav()).findByText("ยังไม่มีแชต");

  expect(within(listNav()).queryAllByRole("heading")).toEqual([]);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("[FR-CHAT-050] clicking a chat in the list opens it with all its messages and marks it current", async () => {
  stubServer(FOUR, (id) => Response.json(detail(id, "แชตวันนี้เก่ากว่า", ["ข้อความหนึ่ง", "ข้อความสอง"])));
  render(<ChatShell />);
  await within(listNav()).findByText("วันนี้ (2)");

  fireEvent.click(within(listNav()).getByRole("button", { name: "แชตวันนี้เก่ากว่า" }));

  const conversation = screen.getByRole("region", { name: "บทสนทนา" });
  await within(conversation).findByText("ข้อความสอง");
  expect(within(conversation).getAllByText(/ข้อความ/)).toHaveLength(2);
  expect(screen.getByRole("heading", { level: 1, name: "แชตวันนี้เก่ากว่า" })).toBeInTheDocument();
  expect(within(listNav()).getByRole("button", { name: "แชตวันนี้เก่ากว่า" }).closest("li")).toHaveAttribute("aria-current", "true");
});

test("[TC-CHAT-013] opening a chat that is gone shows the Thai message from the server and nothing technical", async () => {
  stubServer(FOUR, () => Response.json({ error: "ไม่พบแชตนี้" }, { status: 404 }));
  render(<ChatShell />);
  await within(listNav()).findByText("วันนี้ (2)");

  fireEvent.click(within(listNav()).getByRole("button", { name: "แชตเมื่อวาน" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("ไม่พบแชตนี้");
});

test("a reply that arrives late for an earlier click does not replace the chat opened last", async () => {
  let releaseFirst: (res: Response) => void = () => undefined;
  const first = new Promise<Response>((resolve) => (releaseFirst = resolve));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith(A)) return first;
      if (url.endsWith(B)) return Response.json(detail(B, "แชตวันนี้เก่ากว่า", ["ของแชต B"]));
      return Response.json({ chats: FOUR });
    }),
  );
  render(<ChatShell />);
  await within(listNav()).findByText("วันนี้ (2)");

  fireEvent.click(within(listNav()).getByRole("button", { name: "แชตวันนี้ล่าสุด" }));
  fireEvent.click(within(listNav()).getByRole("button", { name: "แชตวันนี้เก่ากว่า" }));
  await screen.findByText("ของแชต B");
  releaseFirst(Response.json(detail(A, "แชตวันนี้ล่าสุด", ["ของแชต A"])));

  await waitFor(() => expect(screen.queryByText("ของแชต A")).toBeNull());
  expect(screen.getByText("ของแชต B")).toBeInTheDocument();
});

test("[TC-NFR-021] the list shows a marker only on chats the server flags as not edited for over 5 years", async () => {
  stubServer([chat(A, "แชตเก่ามาก", "2021-10-17T05:00:00Z", true), chat(B, "แชตปกติ", "2026-10-18T04:00:00Z")]);
  render(<ChatShell />);

  await within(listNav()).findByText("แชตเก่ามาก");

  const old = within(listNav()).getByRole("button", { name: /แชตเก่ามาก/ }).closest("li")!;
  const normal = within(listNav()).getByRole("button", { name: /แชตปกติ/ }).closest("li")!;
  expect(within(old).getByText("เกิน 5 ปี")).toBeInTheDocument();
  expect(within(normal).queryByText("เกิน 5 ปี")).toBeNull();
});

test("[NFR-COMP-020] on a small screen the menu button opens the chat list drawer with a new chat button, and Esc, the backdrop and choosing a chat close it", async () => {
  stubServer(FOUR, (id) => Response.json(detail(id, "แชตเมื่อวาน", ["x"])));
  render(<ChatShell />);
  await within(listNav()).findByText("วันนี้ (2)");
  const drawer = screen.getByRole("complementary", { name: "ประวัติแชต" });
  expect(drawer).toHaveAttribute("data-open", "false");

  fireEvent.click(screen.getByRole("button", { name: "เปิดประวัติแชต" }));
  expect(drawer).toHaveAttribute("data-open", "true");
  expect(within(drawer).getByRole("button", { name: "แชตใหม่" })).toBeInTheDocument();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(drawer).toHaveAttribute("data-open", "false");

  fireEvent.click(screen.getByRole("button", { name: "เปิดประวัติแชต" }));
  fireEvent.click(screen.getByRole("button", { name: "ปิดประวัติแชต" }));
  expect(drawer).toHaveAttribute("data-open", "false");

  fireEvent.click(screen.getByRole("button", { name: "เปิดประวัติแชต" }));
  fireEvent.click(within(drawer).getByRole("button", { name: "แชตเมื่อวาน" }));
  await waitFor(() => expect(drawer).toHaveAttribute("data-open", "false"));
});

test("[NFR-COMP-020] the drawer moves focus to its new chat button when it opens and back to the menu button when it closes", async () => {
  stubServer(FOUR, (id) => Response.json(detail(id, "แชตเมื่อวาน", ["x"])));
  render(<ChatShell />);
  await within(listNav()).findByText("วันนี้ (2)");
  const drawer = screen.getByRole("complementary", { name: "ประวัติแชต" });
  const menu = screen.getByRole("button", { name: "เปิดประวัติแชต" });

  fireEvent.click(menu);
  expect(within(drawer).getAllByRole("button", { name: "แชตใหม่" })[0]).toHaveFocus();

  fireEvent.keyDown(document, { key: "Escape" });
  expect(menu).toHaveFocus();

  fireEvent.click(menu);
  fireEvent.click(screen.getByRole("button", { name: "ปิดประวัติแชต" }));
  expect(menu).toHaveFocus();
});
