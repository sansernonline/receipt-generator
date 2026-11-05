import type { Draft } from "@/features/draft/types";
import type { BillTotals } from "@/features/totals/types";
import { COLUMNS } from "./bill-columns";
import type { TemplateId } from "./bill-templates";

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;

type Props = { template: TemplateId; draft: Draft; totals: BillTotals };

export function BillItems({ template, draft, totals }: Props) {
  const hasLineDiscount = draft.items.some((item) => item.discount !== null);
  const columns = COLUMNS[template].filter((column) => !column.isDiscount || hasLineDiscount || template === "taxinv");
  return (
    <table className="w-full border-collapse text-[13px]">
      <caption className="sr-only">รายการสินค้า</caption>
      <thead>
        <tr>
          {columns.map(({ header, align, minWidth = "" }) => (
            <th key={header} scope="col" className={`${minWidth} border-b border-ink bg-[#f5f5f9] px-1.5 py-1.5 font-semibold ${ALIGN[align]}`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {draft.items.map((item, index) => (
          <tr key={index}>
            {columns.map(({ header, align, cell, minWidth }) => (
              <td key={header} className={`${minWidth ? `${minWidth} break-words` : "whitespace-nowrap"} border-b border-[#d8d8e0] px-1.5 py-1 align-top ${ALIGN[align]}`}>
                {cell({ item, index, amount: totals.lines[index].amount })}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
