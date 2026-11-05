import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { draftWith } from "@/features/draft/test-kit";
import type { BillInfo, Draft } from "@/features/draft/types";
import { BillPreview } from "./bill-preview";
import type { BillData } from "./types";

afterEach(cleanup);

const billOf = (draft: Draft): BillData => ({ draft, totals: totalsOf(draft) });
const withBill = (info: Partial<BillInfo>): Draft => {
  const draft = draftWith();
  return { ...draft, bill: { ...draft.bill, ...info } };
};
const withRemarks = (remarks: string): Draft => {
  const draft = draftWith();
  return { ...draft, footer: { ...draft.footer, remarks } };
};
const paper = () => screen.getByRole("article");
const pickTemplate = (name: string) => fireEvent.change(screen.getByRole("combobox", { name: "แม่แบบ" }), { target: { value: name } });

test("[TC-DOC-001] the preview shows both lines and the net amount 295.00 beside the chat", () => {
  render(<BillPreview bill={billOf(draftWith())} />);

  expect(within(paper()).getByText("กาแฟเย็น")).toBeVisible();
  expect(within(paper()).getByText("ครัวซองต์")).toBeVisible();
  expect(within(paper()).getAllByText("295.00").length).toBeGreaterThan(0);
  expect(within(paper()).getByText("สองร้อยเก้าสิบห้าบาทถ้วน")).toBeVisible();
});

test("[TC-DOC-002] the cash bill template shows book/number, name, address and the collector", () => {
  render(<BillPreview bill={billOf(draftWith())} />);

  pickTemplate("cash");

  const bill = within(paper());
  for (const label of ["เล่มที่", "เลขที่", "นาม", "ที่อยู่", "ผู้รับเงิน (Collector)"]) expect(bill.getByText(label)).toBeVisible();
});

test("[TC-DOC-002] the receipt template shows customer, product code, payment and the signature", () => {
  render(<BillPreview bill={billOf(draftWith())} />);

  pickTemplate("receipt");

  const bill = within(paper());
  for (const label of ["ลูกค้า", "รหัสสินค้า", "วิธีชำระ", "ผู้รับเงิน"]) expect(bill.getByText(label, { exact: false })).toBeVisible();
});

test("[TC-DOC-002] the tax invoice template says ใบกำกับภาษี and has payer and receiver signatures", () => {
  render(<BillPreview bill={billOf(draftWith())} />);

  pickTemplate("taxinv");

  const bill = within(paper());
  expect(bill.getByRole("heading", { name: /ใบกำกับภาษี/ })).toBeVisible();
  expect(bill.getByText("ผู้จ่ายเงิน")).toBeVisible();
  expect(bill.getByText("ผู้รับเงิน")).toBeVisible();
});

test("[TC-DOC-002] the invoice template says ใบแจ้งหนี้ and Invoice, three signatures, and has no receiver-of-money box", () => {
  render(<BillPreview bill={billOf(draftWith())} />);

  pickTemplate("invoice");

  const bill = within(paper());
  expect(bill.getByRole("heading", { name: /ใบแจ้งหนี้/ })).toBeVisible();
  expect(bill.getByText("Invoice")).toBeVisible();
  for (const label of ["ผู้รับสินค้า", "ผู้ส่งสินค้า", "ผู้ออก"]) expect(bill.getByText(label)).toBeVisible();
  expect(bill.queryByText("ผู้รับเงิน")).toBeNull();
});

test("[TC-DOC-003] a chat with no draft shows the empty state: no bill, no amount, no error", () => {
  render(<BillPreview bill={null} />);

  expect(screen.getByText("ตัวอย่างบิลจะขึ้นที่นี่")).toBeVisible();
  expect(screen.queryByRole("article")).toBeNull();
  expect(screen.queryByText(/\d\.\d\d/)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("[TC-DOC-003] a draft with no lines shows the same empty state", () => {
  render(<BillPreview bill={billOf(draftWith([]))} />);

  expect(screen.getByText("ตัวอย่างบิลจะขึ้นที่นี่")).toBeVisible();
  expect(screen.queryByRole("article")).toBeNull();
});

test("[TC-DOC-003] when the draft cannot be loaded it says so and still shows no bill", () => {
  render(<BillPreview bill={null} hasError />);

  expect(screen.getByText("โหลดตัวอย่างบิลไม่ได้ ลองเปิดแชตอีกครั้ง")).toBeVisible();
  expect(screen.queryByRole("article")).toBeNull();
});

test("[TC-DOC-031] the draft status is shown above the bill, not on it", () => {
  render(<BillPreview bill={billOf(draftWith())} />);

  expect(screen.getByText("ยังไม่ออกบิล")).toBeVisible();
  expect(paper()).not.toHaveTextContent("ยังไม่ออกบิล");
  expect(paper()).not.toHaveTextContent("ร่าง");
});

test("[FR-DOC-120] the status lives in a live region that stays in the page when the draft arrives", () => {
  const { rerender } = render(<BillPreview bill={null} />);
  const live = document.querySelector("[aria-live=polite]");

  rerender(<BillPreview bill={billOf(draftWith())} />);

  expect(document.querySelector("[aria-live=polite]")).toBe(live);
  expect(live).toHaveTextContent("ยังไม่ออกบิล");
});

test("[TC-DOC-001] the item table has a caption and column headers", () => {
  render(<BillPreview bill={billOf(draftWith())} />);

  const table = within(paper()).getByRole("table", { name: "รายการสินค้า" });

  expect(within(table).getAllByRole("columnheader").length).toBeGreaterThan(3);
});

test("[TC-HDR-034] customer and bill number from the draft show in the bill", () => {
  render(<BillPreview bill={billOf(withBill({ customerName: "คุณสมชาย ใจดี", billNumber: "RC-0042" }))} />);

  expect(within(paper()).getByText("คุณสมชาย ใจดี")).toBeVisible();
  expect(within(paper()).getByText("RC-0042")).toBeVisible();
});

test("[TC-HDR-056] customer phone and email from the draft show in the bill", () => {
  render(<BillPreview bill={billOf(withBill({ customerPhone: "081-234-5678", customerEmail: "somchai@example.com" }))} />);

  expect(paper()).toHaveTextContent("081-234-5678");
  expect(paper()).toHaveTextContent("somchai@example.com");
});

test("[TC-HDR-034] the bill date is shown as dd/mm/yyyy in the Buddhist era", () => {
  render(<BillPreview bill={billOf(withBill({ billDate: { d: 20, m: 10, y: 2026, era: "CE" } }))} />);

  expect(paper()).toHaveTextContent("20/10/2569");
});

test("[TC-HDR-035] a customer name with an HTML tag shows as text: no element, no image", () => {
  const name = "<img src=x onerror=alert(1)>";
  const { container } = render(<BillPreview bill={billOf(withBill({ customerName: name }))} />);

  expect(within(paper()).getByText(name)).toBeVisible();
  expect(container.querySelector("img")).toBeNull();
});

test("[TC-HDR-057] an email and a phone with HTML tags show as text on every template", () => {
  const email = `"><img src=x onerror=alert(1)>@example.com`;
  const { container } = render(<BillPreview bill={billOf(withBill({ customerEmail: email, customerPhone: "<b>081</b>" }))} />);

  for (const template of ["cash", "receipt", "taxinv", "invoice"]) {
    pickTemplate(template);
    expect(paper()).toHaveTextContent(email);
    expect(paper()).toHaveTextContent("<b>081</b>");
  }
  expect(container.querySelector("img, b")).toBeNull();
});

test("[TC-TOT-033] a short remark shows at the foot of the bill", () => {
  render(<BillPreview bill={billOf(withRemarks("รับกลับบ้าน"))} />);

  expect(within(paper()).getByText("รับกลับบ้าน")).toBeVisible();
});

test("[TC-TOT-035] a remark with an HTML tag shows as text: no element, no image", () => {
  const remarks = "<img src=x onerror=alert(1)>";
  const { container } = render(<BillPreview bill={billOf(withRemarks(remarks))} />);

  expect(within(paper()).getByText(remarks)).toBeVisible();
  expect(container.querySelector("img")).toBeNull();
});

test("[FR-TOT-020] VAT lines and the net amount are the server's totals, not recomputed", () => {
  const draft = draftWith();
  const bill = billOf({ ...draft, footer: { ...draft.footer, vat: { mode: "exclusive", rate: 7 } } });
  bill.totals = { ...bill.totals, vat: 12345.67, net: 99999.99 }; // values the browser could not get by calculating

  render(<BillPreview bill={bill} />);

  expect(paper()).toHaveTextContent("12,345.67");
  expect(paper()).toHaveTextContent("99,999.99");
});
