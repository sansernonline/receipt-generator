import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { draftWith } from "@/features/draft/test-kit";
import type { Draft } from "@/features/draft/types";
import { acknowledgeAiNotice } from "../consent/ai-notice-flag";
import { ChatShell } from "./chat-shell";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const row = (id: string, title: string) => ({ id, title, updatedAt: "2026-10-18T04:00:00Z", isStale: false });
const LIST = [row(A, "แชตมีบิล"), row(B, "แชตว่าง")];
const pair = (draft: Draft) => ({ draft, totals: totalsOf(draft) });
const withCustomer = (name: string): Draft => {
  const draft = draftWith();
  return { ...draft, bill: { ...draft.bill, customerName: name } };
};

type Reply = (url: string, init?: RequestInit) => Response | Promise<Response>;
function stubServer(reply: Reply) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/chats") return Response.json({ chats: LIST });
      if (url.endsWith("/draft")) return reply(url, init);
      if (url.endsWith("/messages")) return reply(url, init);
      const id = url.split("/").pop()!;
      return Response.json({ chat: { id, title: "x", updatedAt: "2026-10-18T04:00:00Z", shopId: null, messages: [] }, draft: { items: [] } });
    }),
  );
}

beforeEach(() => acknowledgeAiNotice());
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const openChat = async (name: string) => {
  fireEvent.click(await screen.findByRole("button", { name }));
};
const preview = () => screen.getByRole("region", { name: "ตัวอย่างบิล" });

test("[TC-DOC-001] opening an old chat loads its draft and shows the bill beside the chat", async () => {
  stubServer(() => Response.json(pair(draftWith())));
  render(<ChatShell />);

  await openChat("แชตมีบิล");

  expect(await within(preview()).findByText("กาแฟเย็น")).toBeInTheDocument();
  expect(within(preview()).getByText("ยังไม่ออกบิล")).toBeInTheDocument();
});

test("[TC-DOC-003] opening a chat whose draft has no lines shows the empty state", async () => {
  stubServer(() => Response.json(pair(draftWith([]))));
  render(<ChatShell />);

  await openChat("แชตว่าง");

  await waitFor(() => expect(within(preview()).getByText("ตัวอย่างบิลจะขึ้นที่นี่")).toBeInTheDocument());
  expect(within(preview()).queryByRole("article")).toBeNull();
});

test("[TC-DOC-003] a draft that cannot be loaded says so in the preview, with no alert and no bill", async () => {
  stubServer(() => new Response("{}", { status: 500 }));
  render(<ChatShell />);

  await openChat("แชตมีบิล");

  expect(await within(preview()).findByText("โหลดตัวอย่างบิลไม่ได้ ลองเปิดแชตอีกครั้ง")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(within(preview()).queryByRole("article")).toBeNull();
});

test("[TC-HDR-034] after a message the bill shows the draft the server answered with", async () => {
  const draft = withCustomer("คุณสมชาย ใจดี");
  stubServer((url) => {
    if (url.endsWith("/messages")) return Response.json({ chat: LIST[0], message: { role: "user", text: "ลูกค้าคุณสมชาย" }, messages: [{ role: "user", text: "ลูกค้าคุณสมชาย" }], notices: [], ...pair(draft) }, { status: 201 });
    return Response.json(pair(draftWith()));
  });
  render(<ChatShell />);
  await openChat("แชตมีบิล");
  await within(preview()).findByText("กาแฟเย็น");

  fireEvent.change(screen.getByRole("textbox", { name: "ข้อความ" }), { target: { value: "ลูกค้าคุณสมชาย" } });
  fireEvent.click(screen.getByRole("button", { name: "ส่ง" }));

  expect(await within(preview()).findByText("คุณสมชาย ใจดี")).toBeInTheDocument();
});

test("a draft that arrives late for an earlier click does not show on the chat opened last", async () => {
  let releaseFirst: (res: Response) => void = () => undefined;
  const first = new Promise<Response>((resolve) => (releaseFirst = resolve));
  stubServer((url) => (url.includes(A) ? first : Response.json(pair(draftWith([])))));
  render(<ChatShell />);
  await openChat("แชตมีบิล");
  await openChat("แชตว่าง");

  releaseFirst(Response.json(pair(draftWith())));

  await waitFor(() => expect(within(preview()).getByText("ตัวอย่างบิลจะขึ้นที่นี่")).toBeInTheDocument());
  expect(within(preview()).queryByText("กาแฟเย็น")).toBeNull();
});

test("[NFR-COMP-020] on a phone the bill tab switches between the chat and the bill", async () => {
  stubServer(() => Response.json(pair(draftWith())));
  render(<ChatShell />);
  const switcher = screen.getByRole("navigation", { name: "สลับมุมมอง" });

  fireEvent.click(within(switcher).getByRole("button", { name: "บิล" }));

  expect(within(switcher).getByRole("button", { name: "บิล" })).toHaveAttribute("aria-pressed", "true");
  expect(within(switcher).getByRole("button", { name: "แชต" })).toHaveAttribute("aria-pressed", "false");
  expect(preview()).not.toHaveClass("max-lg:hidden");
});
