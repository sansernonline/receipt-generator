import { describe, expect, it } from "vitest";
import { hasIncompleteLine, totalsOf } from "./draft-totals";
import { draftWith } from "./test-kit";

describe("totalsOf", () => {
  it("[TC-TOT-004] sums 3 x 55.00 and 2 x 65.00 to 295.00", () => {
    expect(totalsOf(draftWith()).net).toBe(295);
  });

  it("counts a line that is not complete as 0.00 and keeps the line numbers aligned", () => {
    const draft = draftWith();
    draft.items[0] = { ...draft.items[0], unitPrice: null };

    const totals = totalsOf(draft);

    expect(totals.lines.map((l) => l.amount)).toEqual([0, 130]);
  });

  it("[TC-ITEM-003] hasIncompleteLine is false for a full draft and true when a price or qty is blank", () => {
    const blank = (over: object) => draftWith([{ ...draftWith().items[0], ...over }]);

    expect([hasIncompleteLine(draftWith()), hasIncompleteLine(blank({ unitPrice: null })), hasIncompleteLine(blank({ qty: null }))]).toEqual([false, true, true]);
  });
});
