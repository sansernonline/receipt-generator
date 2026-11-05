import { DialogFrame } from "./dialog-frame";

type Props = { title: string; isDeleting: boolean; error: string | null; onConfirm: () => void; onClose: () => void };

const buttonClass = "h-9 rounded-full border border-line-2 px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50";

// the focus starts on cancel so a stray Enter cannot delete (FR-CHAT-070)
export function DeleteDialog({ title, isDeleting, error, onConfirm, onClose }: Props) {
  const footer = (
    <>
      <button type="button" autoFocus onClick={onClose} className={buttonClass}>
        ยกเลิก
      </button>
      <button type="button" disabled={isDeleting} onClick={onConfirm} className={`${buttonClass} border-accent bg-accent text-white hover:bg-accent-fill`}>
        ลบแชต
      </button>
    </>
  );

  return (
    <DialogFrame title="ลบแชตนี้?" footer={footer} onClose={onClose}>
      <p>{`ลบ “${title}” พร้อมข้อความ ร่าง เวอร์ชัน และรูปทั้งหมด ลบแล้วกู้คืนไม่ได้ ข้อมูลลูกค้าในแชตนี้จะถูกลบออกจากระบบภายใน 1 นาที`}</p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-accent">
          {error}
        </p>
      )}
    </DialogFrame>
  );
}
