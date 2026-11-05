import { billDateText } from "./bill-format";
import { BillFoot } from "./bill-foot";
import { BillHead } from "./bill-heads";
import { BillItems } from "./bill-items";
import { templateOf, type TemplateId } from "./bill-templates";
import type { BillData } from "./types";

type Props = { bill: BillData; template: TemplateId; now: Date };

// The sheet carries only bill content: no draft mark, no status (FR-DOC-120). All text goes in as React text, so nothing a customer typed can become markup.
export function BillPaper({ bill: { draft, totals }, template, now }: Props) {
  const dueDate = draft.bill.dueDate;
  return (
    <article aria-label={templateOf(template).name} className="flex aspect-[1/1.41421] w-full flex-col rounded-lg bg-white px-5 pb-6 pt-7 text-[13px] leading-[1.6] text-ink shadow-[0_0_0_1px_rgba(16,16,24,0.06),0_24px_52px_-26px_rgba(16,16,24,0.28)]">
      <BillHead template={template} bill={draft.bill} dateText={billDateText(draft.bill.billDate, now)} dueText={dueDate && billDateText(dueDate, now)} />
      <BillItems template={template} draft={draft} totals={totals} />
      <BillFoot template={template} draft={draft} totals={totals} now={now} />
    </article>
  );
}
