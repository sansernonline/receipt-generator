import { useRef, useState } from "react";
import type { ChatListItem } from "./group-chats";
import { DeleteDialog } from "./delete-dialog";
import { RenameDialog } from "./rename-dialog";

type Props = { chat: { id: string; title: string }; isDisabled: boolean; onRenamed: (chat: ChatListItem) => void; onDeleted: (id: string) => void };
type Dialog = "rename" | "delete" | null;

const GENERIC_ERROR = "ทำรายการไม่สำเร็จ ลองอีกครั้ง";
const menuItemClass = "block w-full px-4 py-2 text-left text-sm hover:bg-surface-2";

// the menu next to the chat title: the only place a chat can be renamed or deleted
export function ChatActions({ chat, isDisabled, onRenamed, onDeleted }: Props) {
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

  async function send(init: RequestInit, onDone: (body: { chat: ChatListItem } | null) => void) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${chat.id}`, init);
      const body = await res.json().catch(() => null); // a 204 has no body
      if (!res.ok) return setError(typeof body?.error === "string" ? body.error : GENERIC_ERROR);
      onDone(body);
      closeDialog();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setIsSaving(false);
    }
  }

  const rename = (title: string) => send({ method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) }, (body) => onRenamed(body!.chat));
  const remove = () => send({ method: "DELETE" }, () => onDeleted(chat.id));

  return (
    <div className="relative ml-auto">
      <button ref={menuButtonRef} type="button" aria-label="เมนูแชต" aria-haspopup="menu" aria-expanded={isMenuOpen} disabled={isDisabled} onClick={() => setIsMenuOpen((open) => !open)} className="grid size-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-50">
        <span aria-hidden="true">⋮</span>
      </button>
      {isMenuOpen && (
        <>
          <div aria-hidden="true" onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-30" />
          <div role="menu" className="absolute right-0 top-10 z-40 w-48 animate-pop-fast overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
            <button type="button" role="menuitem" onClick={() => openDialog("rename")} className={menuItemClass}>
              เปลี่ยนชื่อแชต
            </button>
            <button type="button" role="menuitem" onClick={() => openDialog("delete")} className={`${menuItemClass} text-accent`}>
              ลบแชต
            </button>
          </div>
        </>
      )}
      {dialog === "rename" && <RenameDialog current={chat.title} isSaving={isSaving} serverError={error} onSave={rename} onClose={closeDialog} />}
      {dialog === "delete" && <DeleteDialog title={chat.title} isDeleting={isSaving} error={error} onConfirm={remove} onClose={closeDialog} />}
    </div>
  );
}
