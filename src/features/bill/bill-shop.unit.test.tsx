import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { draftWith } from "@/features/draft/test-kit";
import type { Draft } from "@/features/draft/types";
import { cashShop } from "@/features/shop-header/test-kit";
import type { ShopFields } from "@/features/shop-header/types";
import { BillPreview } from "./bill-preview";
import type { BillData } from "./types";

afterEach(cleanup);

const withShop = (draft: Draft, shop: Partial<ShopFields> = {}): BillData => ({ draft, totals: totalsOf(draft), shop: { id: "s1", ...cashShop, ...shop } });
const article = () => screen.getByRole("article");

test("[TC-HDR-022] a bill with a shop shows its name, address, tax id and phone in the head", () => {
  render(<BillPreview bill={withShop(draftWith())} />);

  expect(within(article()).getByText("ร้านกาแฟบ้านสวน")).toBeInTheDocument();
  expect(within(article()).getByText("12/3 ถ.สุขุมวิท ชลบุรี")).toBeInTheDocument();
  expect(within(article()).getByText("เลขประจำตัวผู้เสียภาษี 0105560000000")).toBeInTheDocument();
  expect(within(article()).getByText("โทร 038-123456")).toBeInTheDocument();
});

test("[TC-HDR-022] a bill without a shop still says there is no shop header", () => {
  render(<BillPreview bill={{ draft: draftWith(), totals: totalsOf(draftWith()) }} />);

  expect(within(article()).getByText("ยังไม่มีหัวร้าน")).toBeInTheDocument();
});

test("[TC-HDR-022] a shop with no lines yet still shows the bill, so the user sees the header they confirmed", () => {
  render(<BillPreview bill={withShop(draftWith([]))} />);

  expect(within(article()).getByText("ร้านกาแฟบ้านสวน")).toBeInTheDocument();
  expect(screen.queryByText("ตัวอย่างบิลจะขึ้นที่นี่")).toBeNull();
});

test.each([["cash", "บิลเงินสด", "A5"], ["receipt", "ใบเสร็จรับเงิน", "A4"], ["taxinv", "ใบกำกับภาษี/ใบเสร็จรับเงิน", "A4"], ["invoice", "ใบแจ้งหนี้", "A4"]] as const)(
  "[FR-HDR-080] the shop's template %s decides the sheet: %s on %s, and the picker goes away",
  (template, name, paper) => {
    render(<BillPreview bill={withShop(draftWith(), { template })} />);

    expect(screen.getByRole("article", { name })).toBeInTheDocument();
    expect(screen.getByText(paper)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "แม่แบบ" })).toBeNull();
  },
);

test("[review] a shop with no tax id marks it missing in red", () => {
  render(<BillPreview bill={withShop(draftWith(), { taxId: "" })} />);

  expect(within(article()).getByText("ยังไม่มีเลขประจำตัวผู้เสียภาษี")).toBeInTheDocument();
});

test("[review] a shop name with an HTML tag shows as text: no element, no image", () => {
  const { container } = render(<BillPreview bill={withShop(draftWith(), { shopName: "<img src=x onerror=alert(1)>" })} />);

  expect(within(article()).getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});

test("[review] a shop with an email shows it in the head", () => {
  render(<BillPreview bill={withShop(draftWith(), { email: "shop@example.com" })} />);

  expect(within(article()).getByText("อีเมล shop@example.com")).toBeInTheDocument();
});

test.each(["cash", "receipt", "taxinv"] as const)("[FR-HDR-160 · 180] on the %s template a shop with no tax id is marked missing", (template) => {
  render(<BillPreview bill={withShop(draftWith(), { taxId: "", template })} />);

  expect(within(article()).getByText("ยังไม่มีเลขประจำตัวผู้เสียภาษี")).toBeInTheDocument();
});

test("[FR-HDR-240] the invoice is not checked for the tax id: nothing is marked missing, a given tax id still shows", () => {
  render(<BillPreview bill={withShop(draftWith(), { taxId: "", template: "invoice" })} />);

  expect(within(article()).queryByText("ยังไม่มีเลขประจำตัวผู้เสียภาษี")).toBeNull();
  cleanup();
  render(<BillPreview bill={withShop(draftWith(), { template: "invoice" })} />);
  expect(within(article()).getByText("เลขประจำตัวผู้เสียภาษี 0105560000000")).toBeInTheDocument();
});
