import { groupChatsByDay, type ChatListItem } from "./group-chats";

type Props = { chats: ChatListItem[]; activeId: string | null; now: Date; isBusy: boolean; hasListError: boolean; hasCreateError: boolean; onNewChat: () => void };

export function ChatList({ chats, activeId, now, isBusy, hasListError, hasCreateError, onNewChat }: Props) {
  return (
    <aside className="hidden flex-col border-r border-line bg-white lg:flex">
      <div className="p-4 font-head text-base font-semibold tracking-wider">BILLGEN</div>
      <button
        type="button"
        onClick={onNewChat}
        disabled={isBusy}
        className="mx-3 mb-2 h-10 rounded-full border border-line-2 px-3 text-left text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
      >
        <span aria-hidden="true">+ </span>แชตใหม่
      </button>
      {hasCreateError && (
        <p role="alert" className="mx-4 mb-2 text-xs text-accent">
          สร้างแชตไม่สำเร็จ ลองอีกครั้ง
        </p>
      )}
      <input
        type="search"
        aria-label="ค้นหาแชต"
        placeholder="ค้นหาชื่อแชต ลูกค้า เลขที่บิล"
        className="mx-3 h-10 rounded-full border border-line-2 px-4 text-sm"
      />
      <nav aria-label="รายการแชต" className="flex-1 overflow-auto p-3 text-sm">
        {hasListError && <p className="p-2 text-accent">โหลดรายการแชตไม่ได้</p>}
        {!hasListError && chats.length === 0 && <p className="p-2 text-ink-3">ยังไม่มีแชต</p>}
        {groupChatsByDay(chats, now).map((group) => (
          <section key={group.label}>
            <h2 className="px-2 pb-0.5 pt-3 text-xs font-semibold text-ink-3">{`${group.label} (${group.chats.length})`}</h2>
            <ul>
              {group.chats.map((chat) => (
                <li
                  key={chat.id}
                  aria-current={chat.id === activeId ? "true" : undefined}
                  className="rounded-lg px-2 py-2 aria-[current=true]:bg-surface-2 aria-[current=true]:font-semibold"
                >
                  {chat.title}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
