import type { Operation } from "./types";

// Hand-written check of the P-004 v0.2 schema (docs/PROMPT-LIBRARY.md) plus the value limits of SRS 6.2.
// An unknown field fails on purpose: it is usually the model trying to send a total or a whole document (ADR-0004).
export type Reply = {
  status: "ok" | "clarify" | "refuse";
  reason: string | null;
  action: string | null;
  operations: Operation[];
  question: string | null;
  reply: string | null;
};

export type ParseResult = { ok: true; value: Reply } | { ok: false; errors: string[] };

const MAX_ERRORS = 5;
const MAX_NAME = 200;
const MAX_NOTE = 200; // question and reply
const MAX_DESCRIPTION = 500;
const MAX_PAYMENT_DETAIL = 300;
const MAX_QUOTE_REF = 30;
const MAX_QUOTED_BY = 80;

type Check = (value: unknown) => string | null;
type Fields = Record<string, Check>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const number: Check = (v) => (typeof v === "number" && Number.isFinite(v) ? null : "ต้องเป็นตัวเลข");
const positive: Check = (v) => number(v) ?? ((v as number) > 0 ? null : "ต้องมากกว่า 0");
const notNegative: Check = (v) => number(v) ?? ((v as number) >= 0 ? null : "ต้องไม่ติดลบ");
const line: Check = (v) => (Number.isInteger(v) && (v as number) >= 1 ? null : "ต้องเป็นเลขบรรทัด");
const text = (max?: number): Check => (v) =>
  typeof v !== "string" || v.length < 1 ? "ต้องเป็นข้อความที่ไม่ว่าง" : max && v.length > max ? `ยาวเกิน ${max} ตัวอักษร` : null;
const orNull = (check: Check): Check => (v) => (v === null ? null : check(v));
const oneOf = (...allowed: (string | null)[]): Check => (v) => (allowed.includes(v as string | null) ? null : "ค่าไม่อยู่ในรายการที่ใช้ได้");
const percentOrAmount: Check = (v) => oneOf("amount", "percent")(v);

const dateFields: Fields = {
  d: (v) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31 ? null : "วันต้องเป็น 1-31"),
  m: (v) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 12 ? null : "เดือนต้องเป็น 1-12"),
  y: orNull((v) => (Number.isInteger(v) ? null : "ปีต้องเป็นจำนวนเต็ม")),
  era: oneOf("BE", "CE", null),
};
const date: Check = (v) => {
  const problem = object(v, dateFields);
  if (problem) return problem;
  const { y, era } = v as { y: unknown; era: unknown };
  return (y === null) === (era === null) ? null : "ปีกับยุคต้องเป็น null คู่กัน";
};

const itemFields: Fields = {
  name: text(MAX_NAME),
  qty: positive,
  unit: orNull(text()),
  unit_price: notNegative,
  code: orNull(text()),
  description: orNull(text(MAX_DESCRIPTION)),
};
const billInfoFields: Fields = {
  customer_name: orNull(text()), customer_address: orNull(text()), customer_tax_id: orNull(text()),
  customer_phone: orNull(text()), customer_email: orNull(text()), doc_no: orNull(text()),
  doc_date: orNull(date), ref: orNull(text()), due_date: orNull(date),
  quote_ref: orNull(text(MAX_QUOTE_REF)), quoted_by: orNull(text(MAX_QUOTED_BY)),
};

const operationFields: Record<string, Fields> = {
  add_item: itemFields,
  update_item: { line, set: (v) => partial(v, itemFields) },
  remove_item: { line },
  set_line_discount: { line, type: percentOrAmount, value: notNegative },
  set_discount: { type: percentOrAmount, value: notNegative },
  set_vat_mode: { mode: oneOf("none", "included", "excluded") },
  set_payment: { method: oneOf("cash", "transfer", "cheque", null), date: orNull(date) },
  set_payment_detail: { text: orNull(text(MAX_PAYMENT_DETAIL)) },
  set_remarks: { text: (v) => (typeof v === "string" ? null : "ต้องเป็นข้อความ") },
  set_bill_info: { fields: (v) => partial(v, billInfoFields) },
};

/** Every listed field must be present, no other field may appear. */
function object(value: unknown, fields: Fields): string | null {
  if (!isObject(value)) return "ต้องเป็นออบเจกต์";
  const extra = Object.keys(value).find((k) => !(k in fields));
  if (extra) return `มีช่องที่ไม่รู้จัก ${JSON.stringify(extra)}`;
  for (const [key, check] of Object.entries(fields)) {
    if (!(key in value)) return `ขาดช่อง ${key}`;
    const problem = check(value[key]);
    if (problem) return `${key}: ${problem}`;
  }
  return null;
}

/** At least one listed field, none outside the list. */
function partial(value: unknown, fields: Fields): string | null {
  if (!isObject(value) || Object.keys(value).length === 0) return "ต้องมีอย่างน้อย 1 ช่อง";
  const extra = Object.keys(value).find((k) => !(k in fields));
  if (extra) return `มีช่องที่ไม่รู้จัก ${JSON.stringify(extra)}`;
  for (const [key, v] of Object.entries(value)) {
    const problem = fields[key](v);
    if (problem) return `${key}: ${problem}`;
  }
  return null;
}

function operationProblem(op: unknown, lineCount: number): string | null {
  if (!isObject(op) || typeof op.op !== "string" || !(op.op in operationFields)) return "op: ไม่อยู่ในชุดคำสั่งที่ใช้ได้";
  const { op: _name, ...rest } = op;
  const problem = object(rest, operationFields[op.op]);
  if (problem) return problem;
  if (typeof op.line === "number" && op.line > lineCount) return "line: ไม่มีบรรทัดนี้ในร่าง";
  return op.type === "percent" && (op.value as number) > 100 ? "value: ร้อยละเกิน 100" : null;
}

const replyFields: Fields = {
  status: oneOf("ok", "clarify", "refuse"),
  reason: oneOf(null, "use_button", "computed_total", "not_supported", "out_of_scope", "internal_info"),
  action: oneOf(null, "edit_header", "delete_chat", "issue_bill", "undo"),
  operations: (v) => (Array.isArray(v) ? null : "ต้องเป็นรายการ"),
  question: orNull(text(MAX_NOTE)),
  reply: orNull(text(MAX_NOTE)),
};

// The model sometimes wraps JSON in a code fence or chatter (PROMPT-LIBRARY 2.3 steps 1-2)
function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function statusProblem(r: Reply): string | null {
  const needs = (cond: boolean, msg: string) => (cond ? null : msg);
  if (r.status === "ok")
    return needs(r.operations.length > 0 && r.reply !== null && !r.reason && !r.action && r.question === null, "status ok: ต้องมี operations และ reply เท่านั้น");
  if (r.status === "clarify")
    return needs(r.operations.length === 0 && r.question !== null && !r.reason && !r.action && r.reply === null, "status clarify: ต้องมี question เท่านั้น");
  return needs(r.operations.length === 0 && !!r.reason && r.question === null && r.reply === null && (r.reason === "use_button") === (r.action !== null), "status refuse: reason กับ action ไม่ตรงกติกา");
}

/** Problems are short Thai lines without any value from the reply (a value could carry injected text). */
export function parseReply(raw: string, context: { lineCount: number }): ParseResult {
  const json = extractJson(raw);
  const shape = object(json, replyFields);
  if (shape) return { ok: false, errors: [shape] };

  const value = json as Reply;
  const errors = value.operations
    .map((op, i) => ({ i, problem: operationProblem(op, context.lineCount) }))
    .filter((e) => e.problem)
    .map((e) => `operations[${e.i}].${e.problem}`);
  const status = errors.length === 0 ? statusProblem(value) : null;
  if (status) errors.push(status);

  return errors.length === 0 ? { ok: true, value } : { ok: false, errors: errors.slice(0, MAX_ERRORS) };
}
