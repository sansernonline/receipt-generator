import type { ReactNode } from "react";
import type { BillInfo } from "@/features/draft/types";
import type { TemplateId } from "./bill-templates";
import { Missing } from "./missing";

type Props = { bill: BillInfo; dateText: string; dueText: string | null };

const Label = ({ children }: { children: ReactNode }) => <span className="text-ink-2">{children}</span>;
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <Label>{label}</Label> <span>{children}</span>
  </div>
);
const contactOf = ({ customerPhone, customerEmail }: BillInfo) =>
  [customerPhone && `โทร ${customerPhone}`, customerEmail && `อีเมล ${customerEmail}`].filter(Boolean).join(" · ");

// simple: the shop header is not stored yet (rows 35 · 38), so every template shows the "no shop header" placeholder
function ShopBlock() {
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-semibold">
        <Missing>ยังไม่มีหัวร้าน</Missing>
      </p>
    </div>
  );
}

function Title({ th, en }: { th: string; en: string }) {
  return (
    <div className="text-right">
      <h2 className="text-[22px] font-semibold leading-snug text-accent">{th}</h2>
      <p className="text-[13px] tracking-[0.08em] text-ink-2">{en}</p>
    </div>
  );
}

const TopRow = ({ th, en }: { th: string; en: string }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
    <ShopBlock />
    <Title th={th} en={en} />
  </div>
);

const Meta = ({ children }: { children: ReactNode }) => <div className="mb-3 mt-5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-y border-t-ink border-b-[#d8d8e0] py-3">{children}</div>;

function CashHead({ bill, dateText }: Props) {
  return (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <div className="pt-1">
          เล่มที่ <span className="inline-block min-w-14 border-b border-ink text-center">&nbsp;</span>
        </div>
        <ShopBlock />
        <div className="pt-1">
          เลขที่ <span className="inline-block min-w-14 border-b border-ink text-center">{bill.billNumber}</span>
        </div>
      </div>
      <div className="mt-3 border-y-[1.5px] border-ink py-1.5 text-center">
        <h2 className="text-[20px] font-semibold leading-snug">บิลเงินสด</h2>
        <p className="text-[13px] tracking-[0.08em] text-ink-2">CASH SALE</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b border-[#d8d8e0] py-3">
        <Field label="นาม">{bill.customerName}</Field>
        <div className="text-right">
          <Label>วันที่</Label> {dateText}
        </div>
        <Field label="ที่อยู่">{bill.customerAddress}</Field>
        <div className="text-right">{contactOf(bill)}</div>
      </div>
    </>
  );
}

function ReceiptHead({ bill, dateText }: Props) {
  return (
    <>
      <TopRow th="ใบเสร็จรับเงิน" en="RECEIPT" />
      <Meta>
        <Field label="ลูกค้า">{bill.customerName ?? "เงินสด (ทั่วไป)"}</Field>
        <div className="text-right">
          <Label>เลขที่</Label> {bill.billNumber ?? <Missing>ยังไม่มี</Missing>}
        </div>
        {bill.customerAddress && <Field label="ที่อยู่">{bill.customerAddress}</Field>}
        {bill.customerAddress && <div />}
        <div>{contactOf(bill)}</div>
        <div className="text-right">
          <Label>วันที่</Label> {dateText}
        </div>
      </Meta>
    </>
  );
}

function TaxInvoiceHead({ bill, dateText }: Props) {
  return (
    <>
      <TopRow th="ใบกำกับภาษี/ใบเสร็จรับเงิน" en="TAX INVOICE / RECEIPT" />
      <div className="mt-3 border border-ink">
        <p className="border-b border-ink bg-[#f5f5f9] px-2 py-0.5 font-semibold">ผู้ซื้อ</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 p-2">
          <div className="col-span-2">{bill.customerName ?? <Missing>ยังไม่ระบุชื่อผู้ซื้อ</Missing>}</div>
          <div className="col-span-2 text-ink-2">{bill.customerAddress ?? <Missing>ยังไม่ระบุที่อยู่ผู้ซื้อ</Missing>}</div>
          {contactOf(bill) && <div className="col-span-2 text-ink-2">{contactOf(bill)}</div>}
          <Field label="เลขผู้เสียภาษี">{bill.customerTaxId ?? "-"}</Field>
          <div className="text-right">
            <Label>เลขที่</Label> {bill.billNumber ?? <Missing>ยังไม่มี</Missing>} <Label>วันที่</Label> {dateText}
          </div>
        </div>
      </div>
      <div className="h-3" />
    </>
  );
}

function InvoiceHead({ bill, dateText, dueText }: Props) {
  return (
    <>
      <TopRow th="ใบแจ้งหนี้" en="Invoice" />
      <Meta>
        <div>
          <Field label="วันที่">{dateText}</Field>
          {dueText && <Field label="ครบกำหนดชำระ">{dueText}</Field>}
          {bill.quotedBy && <Field label="ผู้เสนอราคา">{bill.quotedBy}</Field>}
        </div>
        <div className="text-right">
          <Field label="เลขที่ใบแจ้งหนี้">{bill.billNumber ?? <Missing>ยังไม่มี</Missing>}</Field>
          {bill.quoteRef && <Field label="อ้างถึงเลขที่ใบเสนอราคา">{bill.quoteRef}</Field>}
        </div>
      </Meta>
      <div className="border border-ink">
        <p className="border-b border-ink bg-[#f5f5f9] px-2 py-0.5 font-semibold">ลูกค้า</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 p-2">
          <p className="col-span-2 font-semibold">{bill.customerName ?? "-"}</p>
          <p className="col-span-2 text-ink-2">{bill.customerAddress ?? "-"}</p>
          <div>โทร {bill.customerPhone ?? "-"}</div>
          <div>อีเมล {bill.customerEmail ?? "-"}</div>
        </div>
      </div>
      <div className="h-3" />
    </>
  );
}

const HEADS: Record<TemplateId, (props: Props) => ReactNode> = { cash: CashHead, receipt: ReceiptHead, taxinv: TaxInvoiceHead, invoice: InvoiceHead };

export const BillHead = ({ template, ...props }: Props & { template: TemplateId }) => HEADS[template](props);
