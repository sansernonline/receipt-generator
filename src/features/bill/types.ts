import type { Draft } from "@/features/draft/types";
import type { BillTotals } from "@/features/totals/types";

/** What the preview needs: the draft and the totals the server computed from it (never recomputed in the browser). */
export type BillData = { draft: Draft; totals: BillTotals };
