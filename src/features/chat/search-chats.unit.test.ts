import { expect, test } from "vitest";
import { searchChats } from "./search-chats";

const chat = (title: string, customerName: string | null = null, billNumber: string | null = null) => ({ id: title, title, updatedAt: "", customerName, billNumber });
const A = chat("แชต A", "สมชาย ใจดี", "RC-2569-0042");
const B = chat("แชต B", "สมหญิง รักดี", "RC-2569-0043");
const C = chat("แชต C");
const titles = (rows: { title: string }[]) => rows.map((row) => row.title);

test("an empty or blank query keeps every chat in order", () => {
  expect(searchChats([A, B, C], "")).toEqual([A, B, C]);
  expect(searchChats([A, B, C], "   ")).toEqual([A, B, C]);
});

test("matches the title, the customer name and the bill number", () => {
  expect(titles(searchChats([A, B, C], "แชต C"))).toEqual(["แชต C"]);
  expect(titles(searchChats([A, B, C], "สมชาย"))).toEqual(["แชต A"]);
  expect(titles(searchChats([A, B, C], "RC-2569-0043"))).toEqual(["แชต B"]);
});

test("ignores letter case and spaces around the query", () => {
  expect(titles(searchChats([A, B], "  rc-2569-0042 "))).toEqual(["แชต A"]);
});

test("a part of a word matches", () => {
  expect(titles(searchChats([A, B], "ใจดี"))).toEqual(["แชต A"]);
});

test("chats without a customer or bill number are not matched by those fields and do not throw", () => {
  expect(searchChats([C], "null")).toEqual([]);
});

test("special characters are plain letters", () => {
  expect(searchChats([A, B, C], ".*")).toEqual([]);
  expect(searchChats([A, B, C], "(")).toEqual([]);
  expect(searchChats([A, B, C], "[")).toEqual([]);
  expect(titles(searchChats([chat("ราคา (ด่วน) [ใหม่] .* ?")], "(ด่วน) [ใหม่] .*"))).toEqual(["ราคา (ด่วน) [ใหม่] .* ?"]);
});

test("5,000 chats are searched in well under a second", () => {
  const many = Array.from({ length: 5000 }, (_, i) => chat(`แชต ${i}`, `ลูกค้า ${i}`, `RC-${i}`));
  const startedAt = performance.now();

  const found = searchChats(many, "RC-4999");

  expect(found).toHaveLength(1);
  expect(performance.now() - startedAt).toBeLessThan(500);
});
