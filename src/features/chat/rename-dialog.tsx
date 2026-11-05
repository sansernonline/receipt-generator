import { useState, type FormEvent } from "react";
import { DialogFrame } from "./dialog-frame";
import { cleanTitle, countChars } from "./chat-title";
import { checkRenameTitle } from "./rename-chat";

type Props = { current: string; isSaving: boolean; serverError: string | null; onSave: (title: string) => void; onClose: () => void };

const buttonClass = "h-9 rounded-full border border-line-2 px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50";

export function RenameDialog({ current, isSaving, serverError, onSave, onClose }: Props) {
  const [value, setValue] = useState(current);
  const checked = checkRenameTitle(value);
  const error = "error" in checked ? checked.error : serverError;

  function submit(event: FormEvent) {
    event.preventDefault();
    if ("title" in checked) onSave(checked.title);
  }

  const footer = (
    <>
      <button type="button" onClick={onClose} className={buttonClass}>
        ยกเลิก
      </button>
      <button type="submit" form="rename-form" disabled={"error" in checked || isSaving} className={`${buttonClass} border-accent-fill bg-accent-fill text-white hover:bg-accent`}>
        บันทึกชื่อ
      </button>
    </>
  );

  return (
    <DialogFrame title="เปลี่ยนชื่อแชต" footer={footer} onClose={onClose}>
      <form id="rename-form" onSubmit={submit}>
        <label className="block">
          <span className="text-xs font-semibold text-ink-2">ชื่อแชต</span>
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            className="mt-1 h-10 w-full rounded-xl border border-line-2 px-3 text-sm aria-[invalid=true]:border-accent"
            aria-invalid={"error" in checked}
          />
        </label>
        {error && (
          <p role="alert" className="mt-1 text-xs text-accent">
            {error}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-3">{`${countChars(cleanTitle(value))}/80 ตัวอักษร`}</p>
      </form>
    </DialogFrame>
  );
}
