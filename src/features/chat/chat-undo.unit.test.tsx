import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { coffee, draftWith } from "@/features/draft/test-kit";
import { cashShop } from "@/features/shop-header/test-kit";
import { ChatShell } from "./chat-shell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const chat = { id: CHAT_ID, title: "บิลร้านกาแฟ", updatedAt: "2026-10-18T04:00:00Z" };
const billBody = (canUndo: boolean) => ({ draft: draftWith([coffee]), totals: totalsOf(draftWith([coffee])), shop: { id: "s1", ...cashShop }, canUndo });

// undoAnswer decides what the undo route says; every call to it is counted
async function openChat(undoAnswer: () => Promise<Response>) {
  const undo = vi.fn(undoAnswer);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/undo")) return undo();
    if (url.endsWith("/draft")) return Response.json(billBody(true));
    if (url.endsWith(CHAT_ID)) return Response.json({ chat: { ...chat, shopId: "s1", messages: [] }, draft: { items: [coffee] } });
    return Response.json({ chats: [chat] });
  }));
  render(<ChatShell />);
  fireEvent.click(await screen.findByRole("button", { name: "บิลร้านกาแฟ" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "ย้อนกลับ" })).toBeEnabled());
  return undo;
}
const undoButton = () => screen.getByRole("button", { name: "ย้อนกลับ" });

test("[FR-ITEM-120] pressing ย้อนกลับ twice in a row while the first is waiting sends one request", async () => {
  let answer!: (res: Response) => void;
  const undo = await openChat(() => new Promise<Response>((resolve) => (answer = resolve)));

  fireEvent.click(undoButton());
  fireEvent.click(undoButton());
  answer(Response.json(billBody(false)));

  await waitFor(() => expect(undoButton()).toBeDisabled());
  expect(undo).toHaveBeenCalledTimes(1);
});

test("[FR-ITEM-120] when the undo fails the button can be pressed again and the user is told", async () => {
  const undo = await openChat(async () => Response.json({ error: "x" }, { status: 500 }));

  fireEvent.click(undoButton());

  expect(await screen.findByRole("alert")).toHaveTextContent("ย้อนกลับไม่สำเร็จ");
  await waitFor(() => expect(undoButton()).toBeEnabled());
  expect(undo).toHaveBeenCalledTimes(1);
});

test("[FR-ITEM-120] after an undo the live region says ย้อนกลับแล้ว", async () => {
  await openChat(async () => Response.json(billBody(false)));

  fireEvent.click(undoButton());

  await waitFor(() => expect(screen.getByText("ย้อนกลับแล้ว")).toBeInTheDocument());
  expect(screen.getByText("ย้อนกลับแล้ว").closest("[aria-live]")).not.toBeNull();
});
