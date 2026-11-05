import { useRef, useState } from "react";
import type { ChatListItem } from "./group-chats";
import { RenameDialog } from "./rename-dialog";

type Props = { chat: { id: string; title: string }; isDisabled: boolean; onRenamed: (chat: ChatListItem) => void };
type Dialog = "rename" | null;

const GENERIC_ERROR = "ทำรายการไม่สำเร็จ ลองอีกครั้ง";
const menuItemClass = "block w-full px-4 py-2 text-left text-sm hover:bg-surface-2";

// the menu next to the chat title: rename now, delete in the next step
export function ChatActions({ chat, isDisabled, onRenamed }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function openDialog(next: Dialog) {
    setIsMenuOpen(false);
    setError(null);
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
    menuButtonRef.current?.focus();
  }

  async function rename(title: string) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${chat.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) return setError(typeof body?.error === "string" ? body.error : GENERIC_ERROR);
      onRenamed(body.chat);
      closeDialog();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative ml-auto">
      <button ref={menuButtonRef} type="button" aria-label="เมนูแชต" aria-haspopup="menu" aria-expanded={isMenuOpen} disabled={isDisabled} onClick={() => setIsMenuOpen((open) => !open)} className="grid size-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-50">
        <span aria-hidden="true">⋮</span>
      </button>
      {isMenuOpen && (
        <>
          <div aria-hidden="true" onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-30" />
          <div role="menu" className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
            <button type="button" role="menuitem" onClick={() => openDialog("rename")} className={menuItemClass}>
              เปลี่ยนชื่อแชต
            </button>
          </div>
        </>
      )}
      {dialog === "rename" && <RenameDialog current={chat.title} isSaving={isSaving} serverError={error} onSave={rename} onClose={closeDialog} />}
    </div>
  );
}
