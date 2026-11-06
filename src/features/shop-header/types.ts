import type { TemplateId } from "@/features/bill/bill-templates";
import type { VatMode } from "@/features/totals/types";

export type LogoCrop = [x: number, y: number, width: number, height: number]; // pixels of the original picture (FR-HDR-260)

// The shop header of one chat (SRS 6.2). "" = not given. The document title is the template's name, so it is not stored.
// accent = the colour taken from the sample picture (#rrggbb); absent = the template's own colour (FR-HDR-040)
// simple: no branch, e-mail format, bill number format or look yet: the edit button and saved shops (row 38) bring them
export type ShopFields = { shopName: string; address: string; taxId: string; phone: string; email: string; template: TemplateId; accent?: string; logoCrop?: LogoCrop };

/** What the card shows and sends back: the fields plus two things that are not stored in shop.json. */
export type ShopProposal = ShopFields & {
  vatMode?: VatMode; // the tax mode the draft starts with (FR-TOT-040); absent = "none"
  uncertain?: (keyof ShopFields)[]; // fields the AI was not sure about (P-001 rule 10)
};

/** What shops/<id>/shop.json holds. logo = shops/<id>/logo.png as a data URL, added when the header is read (FR-HDR-170). */
export type ShopHeader = ShopFields & { id: string; logo?: string };
