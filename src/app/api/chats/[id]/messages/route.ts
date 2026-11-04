import { isAllowedOrigin } from "@/features/chat/same-origin";
import { addUserMessage, MAX_MESSAGE_CHARS } from "@/features/chat/messages";
import { createStore } from "@/features/storage/store";
import { isValidId } from "@/features/storage/ids";

const fail = (error: string, status: number) => Response.json({ error }, { status });

async function readText(request: Request): Promise<string | null> {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  return text.trim() && text.length <= MAX_MESSAGE_CHARS ? text : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return fail("forbidden", 403);
  const { id } = await params;
  if (!isValidId(id)) return fail("รหัสแชตไม่ถูกต้อง", 400);
  const text = await readText(request);
  if (text === null) return fail("ข้อความว่างหรือยาวเกิน 10,000 ตัวอักษร", 400);
  try {
    return Response.json(await addUserMessage(createStore(), id, text), { status: 201 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fail("ไม่พบแชตนี้", 404);
    return fail("บันทึกข้อความไม่สำเร็จ ลองอีกครั้ง", 500); // never echo the error: it can hold a file path
  }
}
