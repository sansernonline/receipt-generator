import { expect, test } from "vitest";
import { titleFromMessage } from "./chat-title";

const graphemes = (text: string) => [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text)].length;

test("[TC-CHAT-005] a 49-character first message is cut at the last space before the 40th character", () => {
  const title = titleFromMessage("ออกบิลร้านกาแฟบ้านสวน ให้คุณสมชาย กาแฟเย็น 3 แก้ว 55 บาท");

  expect(title).toBe("ออกบิลร้านกาแฟบ้านสวน ให้คุณสมชาย กาแฟเย็น 3");
  expect(graphemes(title)).toBe(38);
});

test("[TC-CHAT-006] 45 characters with no space are cut at exactly 40", () => {
  expect(titleFromMessage("ก".repeat(45))).toBe("ก".repeat(40));
});

test("[TC-CHAT-007] exactly 40 characters stay whole, no ellipsis", () => {
  expect(titleFromMessage("ก".repeat(40))).toBe("ก".repeat(40));
});

test("cuts at the space when the 41st character is the space", () => {
  expect(titleFromMessage(`${"ก".repeat(40)} ข`)).toBe("ก".repeat(40));
});

test("counts a consonant with its tone mark as one character", () => {
  expect(titleFromMessage("น้".repeat(40))).toBe("น้".repeat(40));
});

test("turns line breaks and repeated spaces into single spaces", () => {
  expect(titleFromMessage("  ร้านกาแฟ\n\n  บ้านสวน  ")).toBe("ร้านกาแฟ บ้านสวน");
});

test("keeps HTML as literal text", () => {
  expect(titleFromMessage("<script>alert(1)</script> ร้านกาแฟ")).toBe("<script>alert(1)</script> ร้านกาแฟ");
});
