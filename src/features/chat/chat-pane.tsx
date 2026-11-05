import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { MessageBubble } from "./message-bubble";
import { chipsFor, type ChatStage } from "./quick-chips";

export type ChatMessage = { role: string; text: string };

type Props = {
  title: string;
  messages: ChatMessage[];
  text: string;
  stage: ChatStage;
  isBusy: boolean;
  isSending: boolean;
  sendError: string | null;
  openError: string | null;
  menuRef: RefObject<HTMLButtonElement | null>;
  actions?: ReactNode;
  onOpenDrawer: () => void;
  onTextChange: (text: string) => void;
  onFillText: (text: string) => void;
  onSend: () => void;
};

export function ChatPane({ title, messages, text, stage, isBusy, isSending, sendError, openError, menuRef, actions, onOpenDrawer, onTextChange, onFillText, onSend }: Props) {
  const boxRef = useRef<HTMLTextAreaElement>(null);

  function fillBox(fillText: string) {
    onFillText(fillText);
    boxRef.current?.focus();
  }

  const canSend = !isBusy && text.trim() !== "";

  // a closed box loses the focus; give it back when the wait ends so the user can keep typing
  const wasSending = useRef(false);
  useEffect(() => {
    if (wasSending.current && !isSending) boxRef.current?.focus();
    wasSending.current = isSending;
  }, [isSending]);

  // Enter sends, Shift+Enter is a new line; Enter that confirms a Thai/IME word must not send (mockup #s-chat)
  function sendOnEnter(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSend) onSend();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (canSend) onSend();
  }

  return (
    <main className="flex min-h-0 flex-col bg-white">
      <header className="flex h-[52px] items-center gap-2 px-4">
        <button ref={menuRef} type="button" onClick={onOpenDrawer} aria-label="เปิดประวัติแชต" className="-ml-2 grid size-9 place-items-center rounded-full hover:bg-surface-2 lg:hidden">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <h1 className="min-w-0 break-words font-head text-lg font-semibold">{title}</h1>
        {actions}
      </header>
      <section aria-label="บทสนทนา" className="flex flex-1 flex-col gap-2 overflow-auto p-4 text-sm">
        {openError && (
          <p role="alert" className="text-accent">
            {openError}
          </p>
        )}
        {messages.length === 0 && !openError && <p className="text-ink-3">พิมพ์ข้อมูลร้านและรายการสินค้าเพื่อเริ่มออกบิล</p>}
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}
        <div role="status" className="self-start">
          {isSending && (
            <div className="flex items-center gap-2 py-1 text-ink-3">
              <span aria-hidden="true" className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <i key={delay} style={{ animationDelay: `${delay}ms` }} className="size-1.5 animate-pulse rounded-full bg-ink-3 motion-reduce:animate-none" />
                ))}
              </span>
              <span>กำลังทำ…</span>
            </div>
          )}
        </div>
      </section>
      <div className="p-3">
        <div role="group" aria-label="คำสั่งด่วน" className="mb-2 flex gap-2 overflow-x-auto lg:flex-wrap">
          {chipsFor(stage).map(({ label, fillText }) => (
            <button
              key={label}
              type="button"
              disabled={fillText === undefined}
              title={fillText === undefined ? "เร็วๆ นี้" : undefined}
              onClick={() => fillText !== undefined && fillBox(fillText)}
              className="h-8 shrink-0 whitespace-nowrap rounded-full border border-line-2 px-3 text-xs hover:border-accent enabled:hover:bg-surface-2 disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
        {sendError && (
          <p role="alert" className="mb-2 px-2 text-xs text-accent">
            {sendError}
          </p>
        )}
        <form onSubmit={submit} className="flex items-end gap-2 rounded-[22px] border border-line-2 p-2">
          <textarea
            ref={boxRef}
            aria-label="ข้อความ"
            rows={1}
            value={text}
            disabled={isSending}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={sendOnEnter}
            placeholder={isSending ? "กำลังทำ… รอผลก่อนส่งข้อความถัดไป" : "พิมพ์รายการ เช่น ชาไทย 1 แก้ว 50 หรือสั่งแก้ใบเสร็จ"}
            className="min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
          />
          <button type="submit" disabled={!canSend} aria-label="ส่ง" className="size-9 rounded-full bg-accent-fill text-white disabled:opacity-40">
            <span aria-hidden="true">↑</span>
          </button>
        </form>
      </div>
    </main>
  );
}
