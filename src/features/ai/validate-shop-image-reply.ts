import { type Check, type Fields, extractJson, object, oneOf, orNull, text } from "./validate-reply";
import { HEADER_NAMES, MAX_NOTE, branch, taxId, uncertainIn } from "./validate-shop-reply";

// Hand-written check of the P-001 v0.3 schema (docs/PROMPT-LIBRARY.md). Like P-002 an unknown field fails on purpose:
// a customer or an amount in a shop header must never get through (ADR-0004).
export type ShopImageHeader = {
  doc_type: "cash_bill" | "receipt" | "tax_invoice_receipt" | "invoice";
  shop_name: string | null;
  address: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  vat_mode: "none" | "included" | "excluded" | null;
};

export type ShopImageReply = {
  status: "ok" | "empty" | "unsupported_doc" | "refuse";
  reason: "out_of_scope" | "internal_info" | null;
  header: ShopImageHeader | null;
  uncertain: string[];
  note: string | null;
};

export type ShopImageParseResult = { ok: true; value: ShopImageReply } | { ok: false; errors: string[] };

const headerFields: Fields = {
  doc_type: oneOf("cash_bill", "receipt", "tax_invoice_receipt", "invoice"),
  title_th: orNull(text()), title_en: orNull(text()), shop_name: orNull(text()), address: orNull(text()),
  tax_id: orNull(taxId), branch: orNull(branch), phone: orNull(text()), email: orNull(text()),
  doc_no_sample: orNull(text()), vat_mode: oneOf("none", "included", "excluded", null),
};

const replyFields: Fields = {
  status: oneOf("ok", "empty", "unsupported_doc", "refuse"),
  reason: oneOf(null, "out_of_scope", "internal_info"),
  header: orNull((v) => object(v, headerFields)),
  uncertain: uncertainIn([...HEADER_NAMES, "doc_no_sample"]), // P-001 also lets the model doubt the sample bill number
  note: orNull(text(MAX_NOTE)),
};

function statusProblem({ status, reason, header, uncertain }: ShopImageReply): string | null {
  if (status === "ok") return header !== null && reason === null ? null : "status ok: ต้องมี header และ reason เป็น null";
  const isRefuse = status === "refuse";
  return header === null && uncertain.length === 0 && (reason !== null) === isRefuse ? null : `status ${status}: header reason uncertain ไม่ตรงกติกา`;
}

/** Problems are short Thai lines without any value from the reply (a value could carry injected text). */
export function parseShopImageReply(raw: string): ShopImageParseResult {
  try {
    const json = extractJson(raw);
    const problem = object(json, replyFields) ?? statusProblem(json as ShopImageReply);
    return problem ? { ok: false, errors: [problem] } : { ok: true, value: json as ShopImageReply };
  } catch {
    return { ok: false, errors: ["รูปแบบผลไม่ถูกต้อง"] }; // never let an odd reply escape as an exception
  }
}
