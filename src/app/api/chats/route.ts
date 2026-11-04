import { createChat } from "@/features/chat/chats";
import { isStaleChat } from "@/features/chat/stale-chat";
import { failure } from "@/features/chat/route-errors";
import { isAllowedOrigin } from "@/features/chat/same-origin";
import { createStore } from "@/features/storage/store";

export async function GET() {
  const { chats } = await createStore().readIndex();
  const now = new Date();
  return Response.json({ chats: chats.map((chat) => ({ ...chat, isStale: isStaleChat(chat.updatedAt, now) })) });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return failure("forbidden", 403);
  const chat = await createChat(createStore());
  return Response.json({ chat }, { status: 201 });
}
