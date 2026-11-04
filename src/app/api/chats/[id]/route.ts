import { openChat } from "@/features/chat/open-chat";
import { failure, storageFailure } from "@/features/chat/route-errors";
import { isValidId } from "@/features/storage/ids";
import { createStore } from "@/features/storage/store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  try {
    return Response.json(await openChat(createStore(), id));
  } catch (error) {
    return storageFailure(error, "เปิดแชตไม่ได้ ลองอีกครั้ง");
  }
}
