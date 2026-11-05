import { failure, storageFailure } from "@/features/chat/route-errors";
import { isAllowedOrigin } from "@/features/chat/same-origin";
import { sendShopImage } from "@/features/shop-header/send-shop-image";
import { readShop } from "@/features/shop-header/shop-store";
import { isValidId } from "@/features/storage/ids";
import { createStore } from "@/features/storage/store";
import { MAX_UPLOAD_BYTES, TOO_LARGE_MESSAGE, validateUpload } from "@/features/uploads/validate-upload";

const FORM_OVERHEAD_BYTES = 1_000_000; // the form's own fields around the picture

// The sample bill picture of a chat that has no shop header yet; the answer is a card to review, nothing is saved as the shop (FR-HDR-020 · 070)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return failure("forbidden", 403);
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES) return failure(TOO_LARGE_MESSAGE, 400); // refused before the body is read
  const form = await request.formData().catch(() => null);
  const image = form?.get("image"); // a file part, never a plain text field
  if (!image || typeof image === "string") return failure("ไม่พบไฟล์รูป", 400);
  const bytes = new Uint8Array(await image.arrayBuffer());
  const check = validateUpload({ bytes, size: bytes.byteLength });
  if (!check.ok) return failure(check.message, 400);
  try {
    const store = createStore();
    if (await readShop(store, id)) return failure('แชตนี้มีหัวบิลแล้ว แก้ได้ที่ปุ่ม "แก้หัวบิล"', 409);
    return Response.json(await sendShopImage(store, id, { bytes }), { status: 201 });
  } catch (error) {
    return storageFailure(error, "ส่งรูปไม่สำเร็จ ลองอีกครั้ง");
  }
}
