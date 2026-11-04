import Link from "next/link";

export default function NotFound() {
  return (
    <main className="p-8">
      <h1 className="font-head text-2xl font-semibold">ไม่พบหน้า</h1>
      <p className="mt-2 text-ink-3">หน้าที่คุณเปิดไม่มีอยู่ในระบบ</p>
      <Link href="/" className="mt-4 inline-block text-accent underline">กลับไปหน้าแชต</Link>
    </main>
  );
}
