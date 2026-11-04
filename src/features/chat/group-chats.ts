import { todayInBangkok, type ThaiDate } from "@/features/thai-date/thai-date";

export type ChatListItem = { id: string; title: string; updatedAt: string; isStale?: boolean };
export type ChatGroup = { label: string; chats: ChatListItem[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const isSameDay = (a: ThaiDate, b: ThaiDate) => a.day === b.day && a.month === b.month && a.yearBE === b.yearBE;

// Bangkok has no daylight saving, so "yesterday" is exactly 24 hours back
function labelOf(updatedAt: string, now: Date): string {
  const day = todayInBangkok(new Date(updatedAt));
  if (isSameDay(day, todayInBangkok(now))) return "วันนี้";
  if (isSameDay(day, todayInBangkok(new Date(now.getTime() - DAY_MS)))) return "เมื่อวาน";
  return "ก่อนหน้า";
}

export function groupChatsByDay(chats: ChatListItem[], now: Date): ChatGroup[] {
  return ["วันนี้", "เมื่อวาน", "ก่อนหน้า"]
    .map((label) => ({ label, chats: chats.filter((chat) => labelOf(chat.updatedAt, now) === label) }))
    .filter((group) => group.chats.length > 0);
}
