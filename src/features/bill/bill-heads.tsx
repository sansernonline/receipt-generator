import type { ReactNode } from "react";
import type { BillInfo } from "@/features/draft/types";
import type { ShopHeader } from "@/features/shop-header/types";
import type { TemplateId } from "./bill-templates";
import { Missing } from "./missing";

type Props = { bill: BillInfo; shop: ShopHeader | null; dateText: string; dueText: string | null };

const Label = ({ children }: { children: ReactNode }) => <span className="text-ink-2">{children}</span>;
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <Label>{label}</Label> <span>{children}</span>
  </div>
);
const contactOf = ({ customerPhone, customerEmail }: BillInfo) =>
  [customerPhone && `โทร ${customerPhone}`, customerEmail && `อีเมล ${customerEmail}`].filter(Boolean).join(" · ");

const Small = ({ children }: { children: ReactNode }) => <p className="break-words text-[12px] leading-snug text-ink-2">{children}</p>;

// the shop header of the chat; a missing tax id is marked red except on the invoice, which is not checked against section 86/4 or 105 bis (FR-HDR-160 · 180 · 240)
function ShopBlock({ shop }: { shop: ShopHeader | null }) {
  if (!shop) {
    return (
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">
          <Missing>ยังไม่มีหัวร้าน</Missing>
        </p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="break-words text-[15px] font-semibold leading-snug">{shop.shopName}</p>
      {shop.address && <Small>{shop.address}</Small>}
      {(shop.taxId || shop.template !== "invoice") && <Small>{shop.taxId ? `เลขประจำตัวผู้เสียภาษี ${shop.taxId}` : <Missing>ยังไม่มีเลขประจำตัวผู้เสียภาษี</Missing>}</Small>}
      {shop.phone && <Small>โทร {shop.phone}</Small>}
      {shop.email && <Small>อีเมล {shop.email}</Small>}
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

const TopRow = ({ th, en, shop }: { th: string; en: string; shop: ShopHeader | null }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
    <ShopBlock shop={shop} />
    <Title th={th} en={en} />
  </div>
);

const Meta = ({ children }: { children: ReactNode }) => <div className="mb-3 mt-5 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-y border-t-ink border-b-[#d8d8e0] py-3">{children}</div>;

function CashHead({ bill, shop, dateText }: Props) {
  return (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <div className="pt-1">
          เล่มที่ <span className="inline-block min-w-14 border-b border-ink text-center">&nbsp;</span>
        </div>
        <ShopBlock shop={shop} />
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

function ReceiptHead({ bill, shop, dateText }: Props) {
  return (
    <>
      <TopRow th="ใบเสร็จรับเงิน" en="RECEIPT" shop={shop} />
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

function TaxInvoiceHead({ bill, shop, dateText }: Props) {
  return (
    <>
      <TopRow th="ใบกำกับภาษี/ใบเสร็จรับเงิน" en="TAX INVOICE / RECEIPT" shop={shop} />
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

function InvoiceHead({ bill, shop, dateText, dueText }: Props) {
  return (
    <>
      <TopRow th="ใบแจ้งหนี้" en="Invoice" shop={shop} />
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
