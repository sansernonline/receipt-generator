type Searchable = { title: string; customerName?: string | null; billNumber?: string | null };

// plain text on the three things a user remembers; the query is never used as a pattern, so ( [ .* are just letters (TC-CHAT-025)
export function searchChats<T extends Searchable>(chats: T[], query: string): T[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") return chats;
  return chats.filter((chat) => [chat.title, chat.customerName, chat.billNumber].some((field) => field?.toLowerCase().includes(wanted)));
}
