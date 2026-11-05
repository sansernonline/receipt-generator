import { failure, storageFailure } from "@/features/chat/route-errors";
import { isAllowedOrigin } from "@/features/chat/same-origin";
import { openDraft } from "@/features/draft/open-draft";
import { ShopLockedError, confirmShop } from "@/features/shop-header/shop-store";
import { parseShopRequest } from "@/features/shop-header/shop-request";
import { checkShop, hasErrors } from "@/features/shop-header/validate-shop";
import { isValidId } from "@/features/storage/ids";
import { createStore } from "@/features/storage/store";

// The only way a shop header is set: the user presses "ใช้หัวบิลนี้" on the card. The fields are checked here, not trusted from the card.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return failure("forbidden", 403);
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  const parsed = parseShopRequest(await request.json().catch(() => null));
  if (!parsed.ok) return failure(parsed.error, 400);
  const { fields, ...extras } = parsed.value;
  const problems = checkShop(fields);
  if (hasErrors(problems)) return Response.json({ error: "ตรวจช่องที่ขีดแดงก่อนใช้หัวบิล", fields: problems.errors }, { status: 400 });
  try {
    const store = createStore();
    await confirmShop(store, id, fields, extras);
    return Response.json(await openDraft(store, id), { status: 201 });
  } catch (error) {
    if (error instanceof ShopLockedError) return failure('แชตนี้มีหัวบิลแล้ว แก้ได้ที่ปุ่ม "แก้หัวบิล"', 409);
    return storageFailure(error, "ใช้หัวบิลไม่สำเร็จ ลองอีกครั้ง");
  }
}
