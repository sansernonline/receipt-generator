const QUICK_COMMANDS = ["ลดท้ายบิล 10%", "VAT ไม่มี", "VAT รวมในราคา", "VAT แยกนอก"];

export function ChatPane({ title }: { title: string }) {
  return (
    <main className="flex min-h-0 flex-col bg-white">
      <header className="flex h-[52px] items-center px-4">
        <h1 className="font-head text-lg font-semibold">{title}</h1>
      </header>
      <section aria-label="บทสนทนา" className="flex-1 overflow-auto p-4 text-sm text-ink-3">
        พิมพ์ข้อมูลร้านและรายการสินค้าเพื่อเริ่มออกบิล
      </section>
      {/* simple: ยังไม่มีการส่งข้อความและชิปคำสั่ง — ปิดปุ่มไว้ ต่อใน FR-CHAT ถัดไป */}
      <div className="p-3">
        <div role="group" aria-label="คำสั่งด่วน" className="mb-2 flex flex-wrap gap-2">
          {QUICK_COMMANDS.map((text) => (
            <button key={text} type="button" disabled className="h-8 rounded-full border border-line-2 px-3 text-xs opacity-60">
              {text}
            </button>
          ))}
        </div>
        <form className="flex items-end gap-2 rounded-[22px] border border-line-2 p-2">
          <textarea
            aria-label="ข้อความ"
            rows={1}
            placeholder="พิมพ์รายการ เช่น ชาไทย 1 แก้ว 50 หรือสั่งแก้ใบเสร็จ"
            className="min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
          />
          <button type="submit" disabled aria-label="ส่ง" className="size-9 rounded-full bg-accent-fill text-white disabled:opacity-40">
            <span aria-hidden="true">↑</span>
          </button>
        </form>
      </div>
    </main>
  );
}
