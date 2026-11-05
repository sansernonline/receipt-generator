import { useState } from "react";
import { BillPaper } from "./bill-paper";
import { DEFAULT_TEMPLATE, TEMPLATES, templateOf, type TemplateId } from "./bill-templates";
import { ScaledPaper } from "./scaled-paper";
import type { BillData } from "./types";

const LOAD_FAILED = "โหลดตัวอย่างบิลไม่ได้ ลองเปิดแชตอีกครั้ง";
const NOT_ISSUED = "ยังไม่ออกบิล";

type Props = { bill: BillData | null; hasError?: boolean; className?: string };

function EmptyState() {
  return (
    <div className="m-auto flex max-w-[280px] flex-col items-center gap-3 text-center text-ink-2">
      <div aria-hidden="true" className="grid h-40 w-[120px] place-items-center rounded-lg border border-dashed border-line-2 text-ink-3">
        <svg viewBox="0 0 24 24" className="size-7 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 13h6 M9 17h6" />
        </svg>
      </div>
      <p className="font-semibold text-ink">ตัวอย่างบิลจะขึ้นที่นี่</p>
      <p>เริ่มจากพิมพ์ข้อมูลร้านและรายการสินค้าในแชต</p>
    </div>
  );
}

/** The bill beside the chat: the paper shows only the bill; the status sits above it, outside the paper (FR-DOC-120). */
export function BillPreview({ bill, hasError = false, className = "" }: Props) {
  const [templateId, setTemplateId] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const template = templateOf(templateId);
  const hasBill = bill !== null && bill.draft.items.length > 0;
  const status = hasBill ? NOT_ISSUED : hasError ? LOAD_FAILED : "";

  return (
    <section aria-label="ตัวอย่างบิล" className={`flex min-h-0 min-w-0 flex-col border-l border-line bg-desk text-sm ${className}`}>
      <header className="flex min-h-[52px] items-center gap-2 px-4">
        <h2 className="font-head text-lg font-semibold">ตัวอย่างบิล</h2>
        {hasBill && <span className="text-ink-3">{template.paper}</span>}
        {hasBill && (
          <select aria-label="แม่แบบ" value={templateId} onChange={(event) => setTemplateId(event.target.value as TemplateId)} className="ml-auto h-8 min-w-0 rounded-full border border-line-2 bg-transparent px-3 text-xs">
            {TEMPLATES.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </header>
      <div aria-live="polite" className="px-4 empty:px-0">
        {status && <span className={`inline-block rounded-full border px-3 py-0.5 text-xs ${hasBill ? "border-line-2 text-ink-2" : "border-accent text-accent"}`}>{status}</span>}
      </div>
      <div className="flex min-h-0 flex-1 overflow-auto px-2 pb-4 pt-3">
        {hasBill ? (
          <ScaledPaper paperWidth={template.paperWidth}>
            <BillPaper bill={bill} template={templateId} now={new Date()} />
          </ScaledPaper>
        ) : (
          !hasError && <EmptyState />
        )}
      </div>
    </section>
  );
}
