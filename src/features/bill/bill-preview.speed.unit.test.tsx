import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { draftWith } from "@/features/draft/test-kit";
import type { Draft, DraftItem } from "@/features/draft/types";
import { BillPreview } from "./bill-preview";
import { formatMoney } from "./bill-format";

afterEach(cleanup);

const RUNS = 20;
const LIMIT_MS = 1000;
const line = (n: number): DraftItem => ({ code: null, name: `สินค้า ${n}`, description: null, qty: 1, unit: "ชิ้น", unitPrice: 10 + n, discount: null });
const withFirstPrice = (draft: Draft, price: number): Draft => ({ ...draft, items: draft.items.map((item, i) => (i === 0 ? { ...item, unitPrice: price } : item)) });

// time from "the answer is in the page state" (rerender) to the new price in the DOM: render cost only, no network
function slowestPriceChange(draft: Draft): number {
  const { rerender } = render(<BillPreview bill={{ draft, totals: totalsOf(draft) }} />);
  let slowest = 0;
  for (let run = 0; run < RUNS; run += 1) {
    const price = 1000 + run; // above every other line price (10+n up to 210 on 200 lines), so the text is new in the bill
    const next = withFirstPrice(draft, price);
    const startedAt = performance.now();
    rerender(<BillPreview bill={{ draft: next, totals: totalsOf(next) }} />);
    expect(screen.getAllByText(formatMoney(price)).length).toBeGreaterThan(0);
    slowest = Math.max(slowest, performance.now() - startedAt);
  }
  return slowest;
}

test("[TC-DOC-034] changing the price of line 1 on a 2-line draft updates the preview within 1 second, 20 times", () => {
  expect(slowestPriceChange(draftWith())).toBeLessThanOrEqual(LIMIT_MS);
});

test("[TC-DOC-035] changing the price of line 1 on a 200-line draft updates the preview within 1 second, 20 times", () => {
  const draft = draftWith(Array.from({ length: 200 }, (_, i) => line(i + 1)));

  expect(slowestPriceChange(draft)).toBeLessThanOrEqual(LIMIT_MS);
});
