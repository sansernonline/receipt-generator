import type { Operation } from "@/features/ai/types";
import type { Discount } from "@/features/totals/types";
import { totalsOf } from "./draft-totals";
import { NOTICE_BAD_VALUE, NOTICE_HEADER_BY_BUTTON, NOTICE_NOT_SUPPORTED, NOTICE_TOO_MANY_OPERATIONS, NOTICE_TOTAL_IS_COMPUTED } from "./notices";
import { parseDate } from "./parse-draft";
import type { BillInfo, Draft, DraftItem, PaymentMethod } from "./types";

export type ApplyResult = { draft: Draft; isApplied: boolean; notices: string[] };
type Handler = (draft: Draft, op: Operation) => Draft | null; // null = a value is not usable

const MAX_OPERATIONS = 50; // simple: self-set ceiling for one message, the SRS gives none
const MAX_TEXT = 500;
const MAX_MONEY = 1e9;
// simple: calcTotals works in whole satang and multiplies by up to 1e4 (percent) and 1e3 (qty); a bill under 1e9 baht keeps every step below
// the safe integer limit. Self-set ceiling, the SRS gives none. validate-reply is the first gate, this is the second.
const MAX_BILL_BAHT = 1e9;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_TEXT;
const isTextOrNull = (v: unknown) => v === null || isText(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_MONEY;
const isPositive = (v: unknown) => isNumber(v) && v > 0;
const isNotNegative = (v: unknown) => isNumber(v) && v >= 0;
const isDateOrNull = (v: unknown) => v === null || parseDate(v) !== null;

type FieldRule<T> = { key: keyof T; isValid: (v: unknown) => boolean };
// AI field name -> where it goes in the draft and what a usable value looks like
const ITEM_FIELDS: Record<string, FieldRule<DraftItem>> = {
  name: { key: "name", isValid: isText },
  qty: { key: "qty", isValid: isPositive },
  unit: { key: "unit", isValid: isTextOrNull },
  unit_price: { key: "unitPrice", isValid: isNotNegative },
  code: { key: "code", isValid: isTextOrNull },
  description: { key: "description", isValid: isTextOrNull },
};
const BILL_FIELDS: Record<string, FieldRule<BillInfo>> = {
  customer_name: { key: "customerName", isValid: isTextOrNull },
  customer_address: { key: "customerAddress", isValid: isTextOrNull },
  customer_tax_id: { key: "customerTaxId", isValid: isTextOrNull },
  customer_phone: { key: "customerPhone", isValid: isTextOrNull },
  customer_email: { key: "customerEmail", isValid: isTextOrNull },
  doc_no: { key: "billNumber", isValid: isTextOrNull },
  doc_date: { key: "billDate", isValid: isDateOrNull },
  ref: { key: "ref", isValid: isTextOrNull },
  due_date: { key: "dueDate", isValid: isDateOrNull },
  quote_ref: { key: "quoteRef", isValid: isTextOrNull },
  quoted_by: { key: "quotedBy", isValid: isTextOrNull },
};
const DATE_FIELDS = ["doc_date", "due_date"];

/** The listed fields of an AI object as draft fields; null when one is unknown or unusable. Money keys not in the rules are refused. */
function readFields<T>(source: unknown, rules: Record<string, FieldRule<T>>, isComplete: boolean): Partial<T> | null {
  if (!isRecord(source)) return null;
  const names = Object.keys(source);
  if (names.length === 0 || names.some((n) => !Object.hasOwn(rules, n))) return null;
  if (isComplete && names.length !== Object.keys(rules).length) return null;
  const fields: Partial<T> = {};
  for (const name of names) {
    const { key, isValid } = rules[name];
    if (!isValid(source[name])) return null;
    fields[key] = (DATE_FIELDS.includes(name) ? parseDate(source[name]) : source[name]) as T[keyof T];
  }
  return fields;
}

const lineIndex = (draft: Draft, op: Operation) => {
  const line = op.line;
  return typeof line === "number" && Number.isInteger(line) && line >= 1 && line <= draft.items.length ? line - 1 : -1;
};

export const usesLineNumbers = (operations: unknown[]) => operations.some((op) => isRecord(op) && Object.hasOwn(op, "line"));

// "line" in an operation counts the lines of the draft the AI was shown, not the draft after the earlier operations of the same batch.
// positions[i] = where original line i+1 is now, -1 once an operation removed it.
function currentLine(line: unknown, positions: number[]): number | null {
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1 || line > positions.length) return null;
  return positions[line - 1] < 0 ? null : positions[line - 1] + 1;
}
const afterRemoval = (positions: number[], removed: number) => positions.map((p) => (p === removed ? -1 : p > removed ? p - 1 : p));
const withItem = (draft: Draft, index: number, change: Partial<DraftItem>): Draft => ({
  ...draft,
  items: draft.items.map((item, i) => (i === index ? { ...item, ...change } : item)),
});
const withFooter = (draft: Draft, change: Partial<Draft["footer"]>): Draft => ({ ...draft, footer: { ...draft.footer, ...change } });

function discountOf({ type, value }: Operation): Discount | null {
  if ((type !== "amount" && type !== "percent") || !isNotNegative(value)) return null;
  return type === "percent" && (value as number) > 100 ? null : { kind: type, value: value as number };
}

const VAT_MODES = { none: "none", included: "inclusive", excluded: "exclusive" } as const;
const PAYMENT_METHODS = ["cash", "transfer", "cheque", null];

const handlers: Record<string, Handler> = {
  add_item(draft, op) {
    const { op: _name, ...fields } = op; // only the six item fields are read, anything else (a "total") makes the operation unusable
    const item = readFields(fields, ITEM_FIELDS, true);
    return item && { ...draft, items: [...draft.items, { ...item, discount: null } as DraftItem] };
  },
  update_item(draft, op) {
    const index = lineIndex(draft, op);
    const change = readFields(op.set, ITEM_FIELDS, false);
    return index < 0 || !change ? null : withItem(draft, index, change);
  },
  remove_item(draft, op) {
    const index = lineIndex(draft, op);
    return index < 0 ? null : { ...draft, items: draft.items.filter((_, i) => i !== index) };
  },
  set_line_discount(draft, op) {
    const index = lineIndex(draft, op);
    const discount = discountOf(op);
    return index < 0 || !discount ? null : withItem(draft, index, { discount });
  },
  set_discount(draft, op) {
    const discount = discountOf(op);
    return discount && withFooter(draft, { discount });
  },
  set_vat_mode(draft, op) {
    if (typeof op.mode !== "string" || !Object.hasOwn(VAT_MODES, op.mode)) return null;
    return withFooter(draft, { vat: { ...draft.footer.vat, mode: VAT_MODES[op.mode as keyof typeof VAT_MODES] } });
  },
  set_payment(draft, op) {
    if (!PAYMENT_METHODS.includes(op.method as string | null) || !isDateOrNull(op.date)) return null;
    return withFooter(draft, { paymentMethod: op.method as PaymentMethod | null, paymentDate: op.date === null ? null : parseDate(op.date) });
  },
  set_payment_detail(draft, op) {
    return isTextOrNull(op.text) ? withFooter(draft, { paymentDetail: op.text as string | null }) : null;
  },
  set_remarks(draft, op) {
    return typeof op.text === "string" && op.text.length <= MAX_TEXT ? withFooter(draft, { remarks: op.text || null }) : null;
  },
  set_bill_info(draft, op) {
    const fields = readFields(op.fields, BILL_FIELDS, false);
    return fields && { ...draft, bill: { ...draft.bill, ...fields } };
  },
};

const HEADER_OP = /^(set|update)_(shop|store|merchant|logo|template|header)/;
const COMPUTED_OP = /(total|subtotal|vat_amount|tax_amount|amount)$/;

function refusalNotice(op: unknown): string {
  const name = isRecord(op) && typeof op.op === "string" ? op.op : "";
  if (HEADER_OP.test(name)) return NOTICE_HEADER_BY_BUTTON;
  return COMPUTED_OP.test(name) ? NOTICE_TOTAL_IS_COMPUTED : NOTICE_NOT_SUPPORTED;
}

const isKnown = (op: unknown): op is Operation => isRecord(op) && typeof op.op === "string" && Object.hasOwn(handlers, op.op);
const refuse = (draft: Draft, notice: string): ApplyResult => ({ draft, isApplied: false, notices: [notice] });

// e.g. a line discount larger than the line: calcTotals refuses it, so the draft must not take it
function canCalculate(draft: Draft): boolean {
  const billBaht = draft.items.reduce((sum, { qty, unitPrice }) => sum + (qty ?? 0) * (unitPrice ?? 0), 0);
  if (billBaht > MAX_BILL_BAHT) return false;
  try {
    totalsOf(draft);
    return true;
  } catch {
    return false;
  }
}

/** All or nothing: one unknown or unusable operation leaves the draft exactly as it was. Money is never read from an operation. */
export function applyOperations(before: Draft, operations: unknown[]): ApplyResult {
  if (operations.length > MAX_OPERATIONS) return refuse(before, NOTICE_TOO_MANY_OPERATIONS);
  const unknownAt = operations.findIndex((op) => !isKnown(op));
  if (unknownAt >= 0) return refuse(before, refusalNotice(operations[unknownAt]));

  let draft = before;
  let positions = before.items.map((_, i) => i);
  for (const op of operations as Operation[]) {
    const hasLine = Object.hasOwn(op, "line");
    const line = hasLine ? currentLine(op.line, positions) : null;
    if (hasLine && line === null) return refuse(before, NOTICE_BAD_VALUE);
    const next = handlers[op.op](draft, hasLine ? { ...op, line } : op);
    if (!next) return refuse(before, NOTICE_BAD_VALUE);
    if (op.op === "remove_item") positions = afterRemoval(positions, (line as number) - 1);
    draft = next;
  }
  return canCalculate(draft) ? { draft, isApplied: true, notices: [] } : refuse(before, NOTICE_BAD_VALUE);
}
