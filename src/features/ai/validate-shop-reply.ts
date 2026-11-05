import { type Check, type Fields, extractJson, object, oneOf, orNull, text } from "./validate-reply";

// Hand-written check of the P-002 v0.3 schema (docs/PROMPT-LIBRARY.md). An unknown field fails on purpose: in a shop header
// it usually means the model is sending a customer, items or an amount (ADR-0004).
export type ShopReplyHeader = {
  doc_type: "cash_bill" | "receipt" | "tax_invoice_receipt" | "invoice" | null;
  shop_name: string | null;
  address: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
};

export type ShopReply = {
  status: "ok" | "empty" | "refuse";
  reason: "out_of_scope" | "internal_info" | null;
  header: ShopReplyHeader | null;
  has_bill_content: boolean;
  uncertain: string[];
  note: string | null;
};

export type ShopParseResult = { ok: true; value: ShopReply } | { ok: false; errors: string[] };

const MAX_NOTE = 200;
const HEADER_NAMES = ["doc_type", "title_th", "title_en", "shop_name", "address", "tax_id", "branch", "phone", "email", "vat_mode"];

const taxId: Check = (v) => (typeof v === "string" && /^[0-9]{1,13}$/.test(v) ? null : "ต้องเป็นตัวเลข 1-13 หลัก");
const branch: Check = (v) => {
  const problem = object(v, { type: oneOf("head_office", "branch"), no: orNull(text()) });
  return problem ?? ((v as { type: string; no: unknown }).type === "head_office" && (v as { no: unknown }).no !== null ? "สำนักงานใหญ่ไม่มีเลขสาขา" : null);
};

const headerFields: Fields = {
  doc_type: oneOf("cash_bill", "receipt", "tax_invoice_receipt", "invoice", null),
  title_th: orNull(text()), title_en: orNull(text()), shop_name: orNull(text()), address: orNull(text()),
  tax_id: orNull(taxId), branch: orNull(branch), phone: orNull(text()), email: orNull(text()),
  doc_no_sample: oneOf(null), vat_mode: oneOf("none", "included", "excluded", null),
};

const uncertain: Check = (v) =>
  Array.isArray(v) && v.every((name) => HEADER_NAMES.includes(name)) && new Set(v).size === v.length ? null : "uncertain: ชื่อช่องไม่ถูกต้อง";

const replyFields: Fields = {
  status: oneOf("ok", "empty", "refuse"),
  reason: oneOf(null, "out_of_scope", "internal_info"),
  header: orNull((v) => object(v, headerFields)),
  has_bill_content: (v) => (typeof v === "boolean" ? null : "ต้องเป็น true หรือ false"),
  uncertain,
  note: orNull(text(MAX_NOTE)),
};

function statusProblem({ status, reason, header, uncertain }: ShopReply): string | null {
  if (status === "ok") return header !== null && reason === null ? null : "status ok: ต้องมี header และ reason เป็น null";
  const isRefuse = status === "refuse";
  return header === null && uncertain.length === 0 && (reason !== null) === isRefuse ? null : `status ${status}: header reason uncertain ไม่ตรงกติกา`;
}

/** Problems are short Thai lines without any value from the reply (a value could carry injected text). */
export function parseShopReply(raw: string): ShopParseResult {
  try {
    const json = extractJson(raw);
    const shape = object(json, replyFields);
    const problem = shape ?? statusProblem(json as ShopReply);
    return problem ? { ok: false, errors: [problem] } : { ok: true, value: json as ShopReply };
  } catch {
    return { ok: false, errors: ["รูปแบบผลไม่ถูกต้อง"] }; // never let an odd reply escape as an exception
  }
}
