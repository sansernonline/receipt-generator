export type TemplateId = "cash" | "receipt" | "taxinv" | "invoice";

export type BillTemplate = { id: TemplateId; name: string; paper: "A4" | "A5"; paperWidth: number };

// logical page width in px: A4 = 794, A5 = 559 (mockup realPx)
export const TEMPLATES: BillTemplate[] = [
  { id: "cash", name: "บิลเงินสด", paper: "A5", paperWidth: 559 },
  { id: "receipt", name: "ใบเสร็จรับเงิน", paper: "A4", paperWidth: 794 },
  { id: "taxinv", name: "ใบกำกับภาษี/ใบเสร็จรับเงิน", paper: "A4", paperWidth: 794 },
  { id: "invoice", name: "ใบแจ้งหนี้", paper: "A4", paperWidth: 794 },
];

// simple: temporary until the saved shop header (rows 35 · 38) says which template a chat uses; the picker in bill-preview.tsx goes away then
export const DEFAULT_TEMPLATE: TemplateId = "receipt";

export const templateOf = (id: TemplateId): BillTemplate => TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[1];
