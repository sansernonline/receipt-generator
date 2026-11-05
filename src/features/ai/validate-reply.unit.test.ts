import { describe, expect, it } from "vitest";
import { parseReply } from "./validate-reply";

const addItem = (over: Record<string, unknown> = {}) => ({ op: "add_item", name: "น้ำเปล่า", qty: 1, unit: "ขวด", unit_price: 10, code: null, description: null, ...over });
const okReply = (operations: unknown[], over: Record<string, unknown> = {}) =>
  JSON.stringify({ status: "ok", reason: null, action: null, operations, question: null, reply: "เพิ่มแล้ว", ...over });
const parse = (raw: string, lineCount = 2) => parseReply(raw, { lineCount });

describe("parseReply", () => {
  it("[TC-AI-002] accepts a correct add_item reply", () => {
    const result = parse(okReply([addItem()]));

    expect(result).toMatchObject({ ok: true, value: { status: "ok", operations: [{ op: "add_item", name: "น้ำเปล่า" }] } });
  });

  it("[TC-AI-001] rejects a quantity written as text", () => {
    expect(parse(okReply([addItem({ qty: "สาม" })])).ok).toBe(false);
  });

  it("[TC-AI-003] accepts a 200 character name and rejects 201, empty, negative qty and an extra field", () => {
    expect(parse(okReply([addItem({ name: "ก".repeat(200) })])).ok).toBe(true);
    expect(parse(okReply([addItem({ name: "ก".repeat(201) })])).ok).toBe(false);
    expect(parse(okReply([addItem({ name: "" })])).ok).toBe(false);
    expect(parse(okReply([addItem({ qty: -1 })])).ok).toBe(false);
    expect(parse(okReply([addItem()], { net_total: 305 })).ok).toBe(false);
  });

  it("[TC-AI-004] rejects the whole batch when a later operation points at a missing line", () => {
    const result = parse(okReply([addItem(), { op: "remove_item", line: 99 }]));

    expect(result.ok).toBe(false);
  });

  it("[TC-AI-010] ADR-0004: an operation outside the closed set or a money field inside one is rejected", () => {
    expect(parse(okReply([{ op: "set_total", value: 1 }])).ok).toBe(false);
    expect(parse(okReply([addItem({ total: 10 })])).ok).toBe(false);
  });

  it("strips a code fence and text around the JSON", () => {
    const raw = "ได้เลย ```json\n" + okReply([addItem()]) + "\n``` เรียบร้อย";

    expect(parse(raw).ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    expect(parse("ขออภัย ทำไม่ได้").ok).toBe(false);
  });

  it("requires status ok to carry operations and a reply, and clarify to carry only a question", () => {
    expect(parse(okReply([])).ok).toBe(false);
    expect(parse(okReply([], { status: "clarify", question: "บรรทัดไหน", reply: null })).ok).toBe(true);
    expect(parse(okReply([addItem()], { status: "clarify", question: "บรรทัดไหน", reply: null })).ok).toBe(false);
  });

  it("accepts a refuse with a reason, and use_button only with an action", () => {
    const refuse = (over: Record<string, unknown>) => okReply([], { status: "refuse", reply: null, ...over });

    expect(parse(refuse({ reason: "out_of_scope" })).ok).toBe(true);
    expect(parse(refuse({ reason: "use_button" })).ok).toBe(false);
    expect(parse(refuse({ reason: "use_button", action: "undo" })).ok).toBe(true);
  });

  it("[TC-AI-018] a refuse that carries operations is accepted with the operations thrown away", () => {
    const raw = okReply([{ op: "remove_item", line: 1 }], { status: "refuse", reason: "out_of_scope", reply: null });

    expect(parse(raw)).toMatchObject({ ok: true, value: { status: "refuse", operations: [] } });
  });

  it("checks update_item, discounts, vat mode and dates", () => {
    expect(parse(okReply([{ op: "update_item", line: 1, set: { qty: 2 } }])).ok).toBe(true);
    expect(parse(okReply([{ op: "update_item", line: 1, set: {} }])).ok).toBe(false);
    expect(parse(okReply([{ op: "set_discount", type: "percent", value: 101 }])).ok).toBe(false);
    expect(parse(okReply([{ op: "set_vat_mode", mode: "all" }])).ok).toBe(false);
    expect(parse(okReply([{ op: "set_payment", method: "cash", date: { d: 31, m: 13, y: null, era: null } }])).ok).toBe(false);
    expect(parse(okReply([{ op: "set_payment", method: "cash", date: { d: 20, m: 10, y: 2569, era: "BE" } }])).ok).toBe(true);
  });

  it("lists at most 5 problems, without echoing any value", () => {
    const bad = Array.from({ length: 8 }, () => addItem({ qty: "SECRET-RAW-OUTPUT" }));

    const result = parse(okReply(bad));

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.errors).toHaveLength(5);
      expect(result.errors.join()).not.toContain("SECRET-RAW-OUTPUT");
    }
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("[review] operation name %s from the prototype is not an operation", (name) => {
    expect(parse(okReply([{ op: name }])).ok).toBe(false);
  });

  it("[review] an extra field called constructor is rejected", () => {
    const raw = okReply([JSON.parse('{"op":"remove_item","line":1,"constructor":1}')]);

    expect(parse(raw).ok).toBe(false);
  });

  it("[review] set with a __proto__ key and a top-level __proto__ key are rejected, not thrown", () => {
    const setRaw = '{"status":"ok","reason":null,"action":null,"question":null,"reply":"x","operations":[{"op":"update_item","line":1,"set":{"__proto__":1}}]}';
    const topRaw = okReply([addItem()]).replace("{", '{"__proto__":{"x":1},');

    expect(parse(setRaw).ok).toBe(false);
    expect(parse(topRaw).ok).toBe(false);
  });

  it("[review] error lines never repeat a key name from the model", () => {
    const raw = okReply([JSON.parse('{"op":"remove_item","line":1,"' + "k".repeat(500) + '":1}')]);

    const result = parse(raw);

    expect(result.ok === false && result.errors.join().length).toBeLessThan(200);
  });

  it("[review] numbers above 1e9, general text above 500 and remarks above 500 are rejected", () => {
    expect(parse(okReply([addItem({ unit_price: 1e10 })])).ok).toBe(false);
    expect(parse(okReply([addItem({ unit: "ก".repeat(501) })])).ok).toBe(false);
    expect(parse(okReply([{ op: "set_remarks", text: "ก".repeat(501) }])).ok).toBe(false);
    expect(parse(okReply([{ op: "set_remarks", text: "ก".repeat(500) }])).ok).toBe(true);
  });
});
