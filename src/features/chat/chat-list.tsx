export function ChatList() {
  return (
    <aside className="hidden flex-col border-r border-line bg-white lg:flex">
      <div className="p-4 font-head text-base font-semibold tracking-wider">BILLGEN</div>
      <button
        type="button"
        className="mx-3 mb-2 h-10 rounded-full border border-line-2 px-3 text-left text-sm font-semibold hover:bg-surface-2"
      >
        <span aria-hidden="true">+ </span>แชตใหม่
      </button>
      <input
        type="search"
        aria-label="ค้นหาแชต"
        placeholder="ค้นหาชื่อแชต ลูกค้า เลขที่บิล"
        className="mx-3 h-10 rounded-full border border-line-2 px-4 text-sm"
      />
      <nav aria-label="รายการแชต" className="flex-1 p-3 text-sm text-ink-3">
        <p className="p-2">ยังไม่มีแชต</p>
      </nav>
    </aside>
  );
}
