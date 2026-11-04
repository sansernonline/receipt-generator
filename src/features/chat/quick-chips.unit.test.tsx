import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ChatPane } from "./chat-pane";
import { ChatShell } from "./chat-shell";
import { chipsFor, stageOf, type ChatStage } from "./quick-chips";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const STAGES: ChatStage[] = ["no-shop", "no-items", "has-items"];
const FIRST_STAGE_CHIP = "ส่งรูปบิลตัวอย่าง";

function renderPane(stage: ChatStage, onFillText = vi.fn()) {
  render(<ChatPane title="แชตใหม่" messages={[]} text="" stage={stage} isBusy={false} hasSendError={false} openError={null} menuRef={createRef()} onOpenDrawer={() => undefined} onTextChange={() => undefined} onFillText={onFillText} onSend={() => undefined} />);
  return within(screen.getByRole("group", { name: "คำสั่งด่วน" }));
}
const chipLabels = (stage: ChatStage) => {
  const chips = renderPane(stage).getAllByRole("button");
  cleanup();
  return chips.map((chip) => chip.textContent);
};

test("[TC-CHAT-030] a new chat with no shop header shows the chip ส่งรูปบิลตัวอย่าง", () => {
  const chips = renderPane("no-shop");

  expect(chips.getByRole("button", { name: FIRST_STAGE_CHIP })).toBeInTheDocument();
});

test("[TC-CHAT-031] every stage shows at least 1 chip and the 3 stages together show at least 3 different chips", () => {
  const perStage = STAGES.map(chipLabels);

  perStage.forEach((labels) => expect(labels.length).toBeGreaterThanOrEqual(1));
  expect(new Set(perStage.flat()).size).toBeGreaterThanOrEqual(3);
});

test("[TC-CHAT-032] a chat that already has items does not show ส่งรูปบิลตัวอย่าง", () => {
  const chips = renderPane("has-items");

  expect(chips.queryByRole("button", { name: FIRST_STAGE_CHIP })).toBeNull();
});

test("a chip that fills the message box calls onFillText with its example text and is enabled", () => {
  const onFillText = vi.fn();
  const chips = renderPane("no-items", onFillText);

  fireEvent.click(chips.getByRole("button", { name: "พิมพ์รายการตัวอย่าง" }));

  expect(onFillText).toHaveBeenCalledWith("กาแฟเย็น 3 แก้ว 55, ครัวซองต์ 2 ชิ้น 65");
});

test.each([["no-shop", FIRST_STAGE_CHIP], ["no-items", "ส่งรูปรายการ"], ["has-items", "ลดท้ายบิล 10%"], ["has-items", "VAT แยกนอก"]] as const)(
  "the %s chip %s has no behaviour yet, so it stays disabled",
  (stage, label) => {
    const chips = renderPane(stage);

    expect(chips.getByRole("button", { name: label })).toBeDisabled();
  },
);

test("every enabled chip fills the box: no chip is enabled without an action", () => {
  for (const stage of STAGES) {
    const chips = renderPane(stage);
    const enabledLabels = chips.getAllByRole("button").filter((chip) => !(chip as HTMLButtonElement).disabled).map((chip) => chip.textContent);
    cleanup();

    expect(enabledLabels).toEqual(chipsFor(stage).filter((chip) => chip.fillText !== undefined).map((chip) => chip.label));
  }
});

test("stageOf: no shop is the first stage, a shop without items is the second, items make the third", () => {
  expect(stageOf({ shopId: null }, { items: [] })).toBe("no-shop");
  expect(stageOf({ shopId: "s1" }, { items: [] })).toBe("no-items");
  expect(stageOf({ shopId: "s1" }, { items: [{}, {}] })).toBe("has-items");
  expect(stageOf({ shopId: "s1" }, undefined)).toBe("no-items");
});

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const detail = (shopId: string | null, items: unknown[]) => ({
  chat: { id: CHAT_ID, title: "บิลร้านกาแฟ", updatedAt: "2026-10-18T04:00:00Z", shopId, messages: [] },
  draft: { items, bill: { customerName: null, billNumber: null } },
});

async function openWith(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith(CHAT_ID) ? Response.json(body) : Response.json({ chats: [{ id: CHAT_ID, title: "บิลร้านกาแฟ", updatedAt: "2026-10-18T04:00:00Z" }] }))));
  render(<ChatShell />);
  fireEvent.click(await screen.findByRole("button", { name: "บิลร้านกาแฟ" }));
  await screen.findByRole("heading", { level: 1, name: "บิลร้านกาแฟ" });
}

test("opening a chat with a shop and 2 items shows the third-stage chips, not the first-stage chip", async () => {
  await openWith(detail("s1", [{}, {}]));

  const chips = within(screen.getByRole("group", { name: "คำสั่งด่วน" }));
  expect(chips.getByRole("button", { name: "VAT ไม่มี" })).toBeInTheDocument();
  expect(chips.queryByRole("button", { name: FIRST_STAGE_CHIP })).toBeNull();
});

test("opening a chat with a shop and no items shows the second-stage chips", async () => {
  await openWith(detail("s1", []));

  expect(within(screen.getByRole("group", { name: "คำสั่งด่วน" })).getByRole("button", { name: "ส่งรูปรายการ" })).toBeInTheDocument();
});

test("clicking พิมพ์ข้อมูลร้าน puts the example text in the message box and the send button becomes usable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ chats: [] })));
  render(<ChatShell />);
  await screen.findByText("ยังไม่มีแชต");

  fireEvent.click(screen.getByRole("button", { name: "พิมพ์ข้อมูลร้าน" }));

  expect(screen.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("ร้านกาแฟบ้านสวน 12/3 ถ.สุขุมวิท ชลบุรี โทร 038-123456 ออกบิลเงินสด");
  expect(screen.getByRole("button", { name: "ส่ง" })).toBeEnabled();
});

test("a disabled chip says it is coming soon; an enabled chip has no such tooltip", () => {
  const chips = renderPane("no-items");

  expect(chips.getByRole("button", { name: "ส่งรูปรายการ" })).toHaveAttribute("title", "เร็วๆ นี้");
  expect(chips.getByRole("button", { name: "พิมพ์รายการตัวอย่าง" })).not.toHaveAttribute("title");
});
