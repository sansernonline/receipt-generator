import { expect, test } from "vitest";
import { checkRenameTitle } from "./rename-chat";

test("[TC-CHAT-015] a normal name is accepted as typed", () => {
  expect(checkRenameTitle("บิลคุณสมชาย")).toEqual({ title: "บิลคุณสมชาย" });
});

test("[TC-CHAT-016] exactly 80 visible characters is accepted", () => {
  const title = "ก".repeat(80);

  expect(checkRenameTitle(title)).toEqual({ title });
});

test("[TC-CHAT-017] 81 visible characters is refused with the reason", () => {
  expect(checkRenameTitle("ก".repeat(81))).toEqual({ error: "ชื่อยาวได้ไม่เกิน 80 ตัวอักษร" });
});

test("[TC-CHAT-017] a very long text is refused without being counted", () => {
  expect(checkRenameTitle("ก".repeat(100_000))).toEqual({ error: "ชื่อยาวได้ไม่เกิน 80 ตัวอักษร" });
});

test.each(["", "   ", "\n\t "])("[TC-CHAT-018] %j is refused", (raw) => {
  expect(checkRenameTitle(raw)).toEqual({ error: "ใส่ชื่ออย่างน้อย 1 ตัวอักษร" });
});

test.each([undefined, null, 5, {}])("[TC-CHAT-018] a non-text value %j is refused", (raw) => {
  expect(checkRenameTitle(raw)).toEqual({ error: "ใส่ชื่ออย่างน้อย 1 ตัวอักษร" });
});

test("control characters and direction overrides are removed, like the title made from a first message", () => {
  expect(checkRenameTitle("บิล\u202Eคุณ\u0007สมชาย\n2")).toEqual({ title: "บิลคุณสมชาย 2" });
});

test("a name with only hidden characters counts as empty", () => {
  expect(checkRenameTitle("\u202E\u0007")).toEqual({ error: "ใส่ชื่ออย่างน้อย 1 ตัวอักษร" });
});

test("HTML stays as text", () => {
  expect(checkRenameTitle("<b>x</b>")).toEqual({ title: "<b>x</b>" });
});
