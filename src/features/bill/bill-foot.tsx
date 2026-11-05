import type { ReactNode } from "react";
import { bahtText } from "@/features/baht-text/baht-text";
import type { Draft, PaymentMethod } from "@/features/draft/types";
import { toSatang } from "@/features/totals/money";
import type { BillTotals } from "@/features/totals/types";
import { billDateText, formatMoney } from "./bill-format";
import type { TemplateId } from "./bill-templates";

type Props = { template: TemplateId; draft: Draft; totals: BillTotals; now: Date };

const PAYMENT_NAME: Record<PaymentMethod, string> = { cash: "เงินสด", transfer: "โอน", cheque: "เช็ค" };

function vatNote({ vat }: Draft["footer"]): string {
  if (vat.mode === "inclusive") return `ราคารวมภาษีมูลค่าเพิ่ม ${vat.rate}% แล้ว`;
  if (vat.mode === "exclusive") return `ราคายังไม่รวมภาษีมูลค่าเพิ่ม ${vat.rate}%`;
  return "ไม่มีภาษีมูลค่าเพิ่ม";
}

function Words({ net }: { net: number }) {
  return (
    <div className="min-h-14 border border-[#d8d8e0] px-3 py-2">
      <p className="text-ink-2">จำนวนเงินเป็นตัวอักษร</p>
      <p className="break-words font-semibold">{net >= 0 ? bahtText(toSatang(net)) : "—"}</p>
    </div>
  );
}

function Payment({ template, draft, now }: Pick<Props, "template" | "draft" | "now">) {
  const { footer } = draft;
  const method = footer.paymentMethod ? PAYMENT_NAME[footer.paymentMethod] : template === "invoice" ? null : PAYMENT_NAME.cash;
  const label = template === "taxinv" ? "การชำระเงิน" : "วิธีชำระ";
  return (
    <p className="mt-3 text-ink-2">
      {method && (
        <>
          {label} <span className="font-semibold text-ink">{method}</span>
          {footer.paymentDate && ` · วันที่ ${billDateText(footer.paymentDate, now)}`}
          <br />
        </>
      )}
      {vatNote(footer)}
    </p>
  );
}

const Line = ({ label, value, isMuted = false }: { label: string; value: string; isMuted?: boolean }) => (
  <div className={`flex justify-between gap-2 py-0.5 ${isMuted ? "text-ink-2" : ""}`}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

// every amount here is what the server computed; this only decides which lines to show (mockup totalsBlk)
function Totals({ template, draft: { footer }, totals }: Pick<Props, "template" | "draft" | "totals">) {
  const { discount, vat } = footer;
  const hasSubtotal = template !== "cash" || discount !== null || vat.mode !== "none";
  return (
    <div>
      {hasSubtotal && <Line label="รวมเป็นเงิน" value={formatMoney(totals.subtotal)} />}
      {discount && <Line label={`ส่วนลด${discount.kind === "percent" ? ` ${discount.value}%` : ""}`} value={`-${formatMoney(totals.billDiscount)}`} />}
      {vat.mode === "inclusive" && (
        <>
          <Line isMuted label="มูลค่าก่อน VAT" value={formatMoney(totals.priceBeforeTax)} />
          <Line isMuted label={`VAT ${vat.rate}% (รวมในราคา)`} value={formatMoney(totals.vat)} />
        </>
      )}
      {vat.mode === "exclusive" && (
        <>
          {discount && <Line isMuted label="ยอดหลังส่วนลด" value={formatMoney(totals.afterDiscount)} />}
          <Line isMuted label={`ภาษีมูลค่าเพิ่ม ${vat.rate}%`} value={`+${formatMoney(totals.vat)}`} />
        </>
      )}
      <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-ink pt-2 font-semibold">
        <span>{template === "cash" ? "รวมเงิน" : "ยอดรวมทั้งสิ้น"}</span>
        <span className="text-[22px] tabular-nums text-accent">{formatMoney(totals.net)}</span>
      </div>
    </div>
  );
}

const Sign = ({ children }: { children: ReactNode }) => <div className="w-[170px] border-t border-dotted border-ink-2 pt-1 text-center text-ink-2">{children}</div>;

function InvoiceSigns() {
  return (
    <div className="mt-auto grid grid-cols-3 gap-4 pt-8">
      {["ผู้รับสินค้า", "ผู้ส่งสินค้า", "ผู้ออก"].map((who) => (
        <div key={who} className="border-t border-dotted border-ink-2 pt-1 text-center text-ink-2">
          <p className="font-semibold text-ink">{who}</p>
          <p className="mt-2 min-h-6 border-b border-dotted border-ink-2 text-left">ตำแหน่ง</p>
          <p className="mt-2 min-h-6 border-b border-dotted border-ink-2 text-left">วันที่</p>
        </div>
      ))}
    </div>
  );
}

function Signs({ template }: { template: TemplateId }) {
  if (template === "invoice") return <InvoiceSigns />;
  const who = template === "taxinv" ? ["ผู้จ่ายเงิน", "ผู้รับเงิน"] : [template === "cash" ? "ผู้รับเงิน (Collector)" : "ผู้รับเงิน"];
  return (
    <div className="mt-auto flex justify-end gap-6 pt-8">
      {who.map((name) => (
        <Sign key={name}>{name}</Sign>
      ))}
    </div>
  );
}

function InvoiceBoxes({ draft }: { draft: Draft }) {
  const { paymentDetail, remarks } = draft.footer;
  const Box = ({ title, text }: { title: string; text: string }) => (
    <div className="mt-2 grid grid-cols-[150px_minmax(0,1fr)] border border-ink">
      <p className="border-r border-ink px-2 py-1 font-semibold">{title}</p>
      <p className="break-words px-2 py-1">{text}</p>
    </div>
  );
  return (
    <>
      {paymentDetail && <Box title="รายละเอียดการโอนเงิน" text={paymentDetail} />}
      {remarks && <Box title="หมายเหตุ" text={remarks} />}
    </>
  );
}

export function BillFoot({ template, draft, totals, now }: Props) {
  const { remarks } = draft.footer;
  return (
    <>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_210px] items-start gap-5 pt-4">
        <div>
          <Words net={totals.net} />
          <Payment template={template} draft={draft} now={now} />
          {remarks && template !== "invoice" && (
            <p className="mt-3 whitespace-pre-line break-words text-ink-2">
              <span className="font-semibold text-ink">หมายเหตุ</span> <span>{remarks}</span>
            </p>
          )}
        </div>
        <Totals template={template} draft={draft} totals={totals} />
      </div>
      {template === "invoice" && <InvoiceBoxes draft={draft} />}
      <Signs template={template} />
    </>
  );
}
