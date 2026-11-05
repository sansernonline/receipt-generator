import { failure } from "@/features/chat/route-errors";
import { isAllowedOrigin } from "@/features/chat/same-origin";
import { recordConsent } from "@/features/consent/record-consent";
import { createStore } from "@/features/storage/store";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return failure("forbidden", 403);
  try {
    await recordConsent(createStore());
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return failure("บันทึกการรับทราบไม่สำเร็จ ลองอีกครั้ง", 500);
  }
}
