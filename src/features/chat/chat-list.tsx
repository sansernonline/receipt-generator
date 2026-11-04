import { groupChatsByDay, type ChatListItem } from "./group-chats";

type Props = {
  chats: ChatListItem[];
  activeId: string | null;
  now: Date;
  isBusy: boolean;
  isDrawerOpen: boolean;
  hasListError: boolean;
  hasCreateError: boolean;
  onNewChat: () => void;
  onOpen: (id: string) => void;
};

export function ChatList({ chats, activeId, now, isBusy, isDrawerOpen, hasListError, hasCreateError, onNewChat, onOpen }: Props) {
  return (
    // below lg the list is a drawer that slides over the chat; invisible while closed so it cannot take focus
    <aside
      aria-label="ประวัติแชต"
      data-open={isDrawerOpen}
      className="absolute inset-y-0 left-0 z-50 flex w-[280px] -translate-x-full flex-col border-r border-line bg-white shadow-xl transition-[transform,visibility] duration-200 max-lg:invisible data-[open=true]:visible data-[open=true]:translate-x-0 lg:static lg:w-auto lg:translate-x-0 lg:shadow-none"
    >
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
                  className="rounded-lg aria-[current=true]:bg-surface-2 aria-[current=true]:font-semibold aria-[current=true]:shadow-[inset_3px_0_0_var(--color-accent)]"
                >
                  <button type="button" onClick={() => onOpen(chat.id)} className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-surface-2">
                    <span className="min-w-0 flex-1 break-words">{chat.title}</span>
                    {chat.isStale && (
                      <span title="ไม่ได้แก้ไขเกิน 5 ปี" className="shrink-0 rounded bg-surface-2 px-1.5 text-[11px] font-normal text-accent">
                        เกิน 5 ปี
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}
