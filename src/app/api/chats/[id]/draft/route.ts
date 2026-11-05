import { openDraft } from "@/features/draft/open-draft";
import { failure, storageFailure } from "@/features/chat/route-errors";
import { isValidId } from "@/features/storage/ids";
import { createStore } from "@/features/storage/store";

// read only (no Origin check, like GET /api/chats/[id]): the bill preview of a chat that is opened again
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  try {
    return Response.json(await openDraft(createStore(), id));
  } catch (error) {
    return storageFailure(error, "เปิดตัวอย่างบิลไม่ได้ ลองอีกครั้ง");
  }
}
