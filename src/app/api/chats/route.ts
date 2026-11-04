import { createChat } from "@/features/chat/chats";
import { isAllowedOrigin } from "@/features/chat/same-origin";
import { createStore } from "@/features/storage/store";

export async function GET() {
  const { chats } = await createStore().readIndex();
  return Response.json({ chats });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const chat = await createChat(createStore());
  return Response.json({ chat }, { status: 201 });
}
