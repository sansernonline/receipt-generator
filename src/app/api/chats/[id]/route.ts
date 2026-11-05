import { openChat } from "@/features/chat/open-chat";
import { checkRenameTitle, renameChat } from "@/features/chat/rename-chat";
import { failure, storageFailure } from "@/features/chat/route-errors";
import { isAllowedOrigin } from "@/features/chat/same-origin";
import { isValidId } from "@/features/storage/ids";
import { createStore } from "@/features/storage/store";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  try {
    return Response.json(await openChat(createStore(), id));
  } catch (error) {
    return storageFailure(error, "เปิดแชตไม่ได้ ลองอีกครั้ง");
  }
}

export async function PATCH(request: Request, { params }: Context) {
  if (!isAllowedOrigin(request)) return failure("forbidden", 403);
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  const body = await request.json().catch(() => null);
  const checked = checkRenameTitle(body?.title);
  if ("error" in checked) return failure(checked.error, 400);
  try {
    return Response.json({ chat: await renameChat(createStore(), id, checked.title) });
  } catch (error) {
    return storageFailure(error, "เปลี่ยนชื่อไม่สำเร็จ ลองอีกครั้ง");
  }
}
