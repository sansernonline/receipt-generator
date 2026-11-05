import type { Draft } from "@/features/draft/types";
import type { ShopHeader } from "@/features/shop-header/types";
import type { BillTotals } from "@/features/totals/types";

/** What the preview needs: the draft, the totals the server computed from it (never recomputed in the browser) and the shop header (none yet = absent or null). */
export type BillData = { draft: Draft; totals: BillTotals; shop?: ShopHeader | null; canUndo?: boolean };
