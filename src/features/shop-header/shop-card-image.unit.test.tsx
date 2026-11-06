import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BillPreview } from "@/features/bill/bill-preview";
import type { BillData } from "@/features/bill/types";
import { totalsOf } from "@/features/draft/draft-totals";
import { emptyDraft } from "@/features/draft/parse-draft";
import { ShopCard } from "./shop-card";
import { cashShop } from "./test-kit";
import type { LogoCrop, ShopProposal } from "./types";

const A = "11111111-1111-4111-8111-111111111111";
const LOGO = { dataUrl: "data:image/png;base64,iVBORw0KGgo=", crop: [10, 20, 300, 120] as LogoCrop }; // made up: the stub's logo, never from a real bill
let posted: Record<string, unknown>[];

// a fake server: it echoes the shop it is asked to save, with the logo when one was sent, like the real one
beforeEach(() => {
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      posted.push(body);
      const { logo, ...fields } = body;
      return Response.json({ draft: emptyDraft(), totals: totalsOf(emptyDraft()), shop: { id: A, ...fields, ...(logo ? { logo } : {}) } }, { status: 201 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// the card and the bill side by side, as in the chat
function Harness({ card, sample, logo }: { card: ShopProposal; sample?: string; logo?: typeof LOGO }) {
  const [bill, setBill] = useState<BillData | null>(null);
  return (
    <>
      <ShopCard card={card} hasFollowUp={false} chatId={A} sample={sample} logo={logo} onUsed={setBill} />
      <BillPreview bill={bill} />
    </>
  );
}

const use = () => fireEvent.click(screen.getByRole("button", { name: "ใช้หัวบิลนี้" }));
const sent = async () => {
  await waitFor(() => expect(posted).toHaveLength(1));
  return posted[0];
};

test("[TC-HDR-049] with the logo switched off, the card is used without it and the bill shows no logo", async () => {
  render(<Harness card={cashShop} sample="blob:sample" logo={LOGO} />);

  fireEvent.click(screen.getByRole("button", { name: "ไม่ใช้โลโก้" }));
  use();

  const body = await sent();
  expect(body).not.toHaveProperty("logo");
  expect(body).not.toHaveProperty("logoCrop");
  await waitFor(() => expect(screen.getByRole("article")).toBeInTheDocument());
  expect(within(screen.getByRole("article")).queryByRole("img")).toBeNull();
});

test("[FR-HDR-170] with the logo kept, the card sends it with its crop and the bill shows it", async () => {
  render(<Harness card={cashShop} sample="blob:sample" logo={LOGO} />);

  use();

  expect(await sent()).toMatchObject({ logo: LOGO.dataUrl, logoCrop: LOGO.crop });
  expect(await within(await screen.findByRole("article")).findByRole("img", { name: "โลโก้ร้าน" })).toHaveAttribute("src", LOGO.dataUrl);
});

test("[FR-HDR-170] the logo can be switched back on after it was switched off", async () => {
  render(<Harness card={cashShop} sample="blob:sample" logo={LOGO} />);

  fireEvent.click(screen.getByRole("button", { name: "ไม่ใช้โลโก้" }));
  fireEvent.click(screen.getByRole("button", { name: "ใช้โลโก้" }));
  use();

  expect(await sent()).toHaveProperty("logo", LOGO.dataUrl);
});

test("[TC-HDR-019] a card with no logo cut shows no logo picture and no ไม่ใช้โลโก้ button", () => {
  render(<Harness card={cashShop} sample="blob:sample" />);

  expect(screen.queryByRole("img", { name: "โลโก้ที่ตัดจากรูป" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^(ไม่ใช้|ใช้)โลโก้$/ })).toBeNull();
});

test("[FR-HDR-050] a card from a picture shows the sample picture to cut the logo from; a card from text does not", () => {
  const { unmount } = render(<Harness card={cashShop} sample="blob:sample" />);
  expect(screen.getByRole("img", { name: "รูปบิลตัวอย่าง" })).toHaveAttribute("src", "blob:sample");
  unmount();

  render(<Harness card={cashShop} />);

  expect(screen.queryByRole("img", { name: "รูปบิลตัวอย่าง" })).toBeNull();
});

test("[FR-HDR-040] the accent from the picture is shown and sent with the card", async () => {
  render(<Harness card={{ ...cashShop, accent: "#1f4e9c" }} sample="blob:sample" />);

  expect(screen.getByText("สีเน้น #1f4e9c")).toBeInTheDocument();
  use();

  expect(await sent()).toMatchObject({ accent: "#1f4e9c" });
});

test("[TC-HDR-016] ใช้สีแม่แบบ drops the colour from the picture: no accent is sent, and it can be taken back", async () => {
  render(<Harness card={{ ...cashShop, accent: "#1f4e9c" }} sample="blob:sample" />);

  fireEvent.click(screen.getByRole("button", { name: "ใช้สีแม่แบบ" }));
  expect(screen.getByRole("button", { name: "ใช้สีจากรูป" })).toBeInTheDocument();
  use();

  expect(await sent()).not.toHaveProperty("accent");
});

test("[TC-HDR-016] the colour from the picture is sent again after ใช้สีจากรูป", async () => {
  render(<Harness card={{ ...cashShop, accent: "#1f4e9c" }} sample="blob:sample" />);

  fireEvent.click(screen.getByRole("button", { name: "ใช้สีแม่แบบ" }));
  fireEvent.click(screen.getByRole("button", { name: "ใช้สีจากรูป" }));
  use();

  expect(await sent()).toMatchObject({ accent: "#1f4e9c" });
});

test("[FR-HDR-040] no accent found: nothing is shown and nothing is sent", async () => {
  render(<Harness card={cashShop} sample="blob:sample" />);

  expect(screen.queryByText(/สีเน้น/)).toBeNull();
  use();

  expect(await sent()).not.toHaveProperty("accent");
});

test("[FR-TOT-040] the tax mode the AI chose is selected, and the user's choice is what is sent", async () => {
  render(<Harness card={{ ...cashShop, vatMode: "exclusive" }} sample="blob:sample" />);
  const select = screen.getByRole("combobox", { name: "วิธีคิดภาษีเริ่มต้น" });
  expect(select).toHaveValue("exclusive");

  fireEvent.change(select, { target: { value: "inclusive" } });
  use();

  expect(await sent()).toMatchObject({ vatMode: "inclusive" });
});

test("[TC-TOT-017] a card with no tax mode (from typed text) starts on none", async () => {
  render(<Harness card={cashShop} />);

  expect(screen.getByRole("combobox", { name: "วิธีคิดภาษีเริ่มต้น" })).toHaveValue("none");
  use();

  expect(await sent()).toMatchObject({ vatMode: "none" });
});

test("[FR-HDR-070] a field the AI was unsure about is marked for checking; the others are not", () => {
  render(<Harness card={{ ...cashShop, uncertain: ["taxId", "template"] }} sample="blob:sample" />);

  expect(screen.getByLabelText(/เลขประจำตัวผู้เสียภาษี/)).toHaveAccessibleDescription("AI ไม่แน่ใจช่องนี้ ตรวจกับรูปอีกครั้ง");
  expect(screen.getByRole("combobox", { name: /แม่แบบ/ })).toHaveAccessibleDescription("AI ไม่แน่ใจช่องนี้ ตรวจกับรูปอีกครั้ง");
  expect(screen.getByLabelText("ชื่อร้าน")).not.toHaveAccessibleDescription();
});

test("[FR-HDR-070] the uncertain hint is not sent back to the server", async () => {
  render(<Harness card={{ ...cashShop, uncertain: ["taxId"] }} sample="blob:sample" />);

  use();

  expect(await sent()).not.toHaveProperty("uncertain");
});
