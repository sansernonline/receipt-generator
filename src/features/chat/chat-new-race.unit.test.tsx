import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { acknowledgeAiNotice } from "../consent/ai-notice-flag";
import { ChatShell } from "./chat-shell";

const OLD = "11111111-1111-4111-8111-111111111111";
const NEW = "22222222-2222-4222-8222-222222222222";
const row = (id: string, title: string) => ({ id, title, updatedAt: "2026-10-18T04:00:00Z", isStale: false });
const detail = { chat: { id: OLD, title: "แชตเก่า", updatedAt: "2026-10-18T04:00:00Z", shopId: null, messages: [{ role: "user", text: "ของแชตเก่า" }] }, draft: { items: [] } };

let releaseCreate: (res: Response) => void = () => undefined;
let createdChats: number;

beforeEach(() => {
  createdChats = 0;
  acknowledgeAiNotice();
  const create = new Promise<Response>((resolve) => (releaseCreate = resolve));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/chats" && init?.method === "POST") {
        createdChats += 1;
        return create;
      }
      if (url === "/api/chats") return Response.json({ chats: [row(OLD, "แชตเก่า")] });
      if (url.endsWith("/draft")) return new Response("{}", { status: 500 });
      return Response.json(detail);
    }),
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const listNav = () => screen.getByRole("navigation", { name: "รายการแชต" });

test("[review] pressing new chat and then opening an old chat: the late answer of the new chat does not replace the old chat on screen", async () => {
  render(<ChatShell />);
  await within(listNav()).findByRole("button", { name: "แชตเก่า" });
  await waitFor(() => expect(screen.getByRole("button", { name: "แชตใหม่" })).toBeEnabled());

  fireEvent.click(screen.getByRole("button", { name: "แชตใหม่" }));
  await waitFor(() => expect(createdChats).toBe(1));
  fireEvent.click(within(listNav()).getByRole("button", { name: "แชตเก่า" }));
  await screen.findByText("ของแชตเก่า");
  releaseCreate(Response.json({ chat: row(NEW, "แชตใหม่") }, { status: 201 }));

  await within(listNav()).findAllByRole("button", { name: /แชตใหม่/ }); // the new chat is in the list
  expect(screen.getByText("ของแชตเก่า")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "แชตเก่า" })).toBeInTheDocument();
});
