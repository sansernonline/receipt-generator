import { expect, test } from "vitest";
import { groupChatsByDay } from "./group-chats";

const NOW = new Date("2026-10-18T05:00:00Z"); // 18 Oct 2026 12:00 Bangkok
const chat = (id: string, updatedAt: string) => ({ id, title: id, updatedAt });

test("groups chats as today, yesterday and earlier, keeping order inside a group", () => {
  const chats = [
    chat("a", "2026-10-18T04:00:00Z"),
    chat("b", "2026-10-18T01:00:00Z"),
    chat("c", "2026-10-17T10:00:00Z"),
    chat("d", "2026-10-01T10:00:00Z"),
  ];

  const groups = groupChatsByDay(chats, NOW);

  expect(groups.map((g) => [g.label, g.chats.map((c) => c.id)])).toEqual([
    ["วันนี้", ["a", "b"]],
    ["เมื่อวาน", ["c"]],
    ["ก่อนหน้า", ["d"]],
  ]);
});

test("uses the Bangkok day, not UTC: 00:30 Bangkok on the 18th is today", () => {
  const groups = groupChatsByDay([chat("a", "2026-10-17T17:30:00Z")], NOW);

  expect(groups.map((g) => g.label)).toEqual(["วันนี้"]);
});

test("leaves out groups with no chats", () => {
  expect(groupChatsByDay([], NOW)).toEqual([]);
});
