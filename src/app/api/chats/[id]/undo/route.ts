import { failure, storageFailure } from "@/features/chat/route-errors";
import { isAllowedOrigin } from "@/features/chat/same-origin";
import { openDraft } from "@/features/draft/open-draft";
import { undoLastEdit } from "@/features/draft/undo-history";
import { isValidId } from "@/features/storage/ids";
import { createStore } from "@/features/storage/store";

// FR-ITEM-120: one step back in the draft (items, bill info, footer). The shop header is not part of the draft, so it stays.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return failure("forbidden", 403);
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  try {
    const store = createStore();
    if (!(await undoLastEdit(store, id))) return failure("ไม่มีการแก้ให้ย้อนกลับ", 409);
    return Response.json(await openDraft(store, id));
  } catch (error) {
    return storageFailure(error, "ย้อนกลับไม่สำเร็จ ลองอีกครั้ง");
  }
}
