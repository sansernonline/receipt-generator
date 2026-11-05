import { isAllowedOrigin } from "@/features/chat/same-origin";
import { countChars } from "@/features/chat/chat-title";
import { MAX_MESSAGE_CHARS } from "@/features/chat/messages";
import { sendMessage } from "@/features/draft/send-message";
import { failure, storageFailure } from "@/features/chat/route-errors";
import { isValidId } from "@/features/storage/ids";
import { createStore } from "@/features/storage/store";

async function readText(request: Request): Promise<string | null> {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  const isTooLong = text.length > MAX_MESSAGE_CHARS * 10 || countChars(text) > MAX_MESSAGE_CHARS; // length check first: counting a huge body is slow
  return text.trim() && !isTooLong ? text : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return failure("forbidden", 403);
  const { id } = await params;
  if (!isValidId(id)) return failure("รหัสแชตไม่ถูกต้อง", 400);
  const text = await readText(request);
  if (text === null) return failure("ข้อความว่างหรือยาวเกิน 10,000 ตัวอักษร", 400);
  try {
    return Response.json(await sendMessage(createStore(), id, text), { status: 201 });
  } catch (error) {
    return storageFailure(error, "บันทึกข้อความไม่สำเร็จ ลองอีกครั้ง");
  }
}
