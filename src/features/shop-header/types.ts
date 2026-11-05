import type { TemplateId } from "@/features/bill/bill-templates";

// The shop header of one chat (SRS 6.2). "" = not given. The document title is the template's name, so it is not stored.
// simple: no branch, e-mail format, bill number format or look yet: the edit button and saved shops (rows 35 · 36 · 38) bring them
export type ShopFields = { shopName: string; address: string; taxId: string; phone: string; email: string; template: TemplateId };

/** What shops/<id>/shop.json holds. */
export type ShopHeader = ShopFields & { id: string };
