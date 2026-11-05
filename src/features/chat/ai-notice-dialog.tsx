import { DialogFrame } from "./dialog-frame";

type Props = { isSaving: boolean; error: string | null; onAccept: () => void; onClose: () => void };

const buttonClass = "h-9 rounded-full border border-line-2 px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50";

// Wording follows mockup #s-consent, which is a draft awaiting legal review (NFR-PDPA-030).
// The focus starts on cancel so a stray Enter cannot accept for the user.
export function AiNoticeDialog({ isSaving, error, onAccept, onClose }: Props) {
  const footer = (
    <>
      <button type="button" autoFocus disabled={isSaving} onClick={onClose} className={buttonClass}>
        ยกเลิก
      </button>
      <button type="button" disabled={isSaving} onClick={onAccept} className={`${buttonClass} border-accent bg-accent text-white hover:bg-accent-fill`}>
        รับทราบและส่งต่อ
      </button>
    </>
  );

  return (
    <DialogFrame title="ก่อนส่งข้อมูลให้ AI" footer={footer} onClose={onClose}>
      <p>ข้อความและรูปที่คุณส่งจะถูกส่งไปยัง Typhoon (OpenTyphoon) ผู้ให้บริการ AI ภายนอก เพื่ออ่านและสร้างบิล</p>
      <p className="mt-2">
        <b>Typhoon เก็บข้อมูลการใช้งานที่ส่งไป</b> เพื่อนำไปปรับปรุงโมเดลของเขา ข้อมูลลูกค้า (ชื่อ ที่อยู่ เลขผู้เสียภาษี) อาจอยู่ในข้อความหรือรูป ส่งเฉพาะที่จำเป็นต่อการออกบิล
      </p>
      <p className="mt-2 text-ink-2">ระบบจะบันทึกวันเวลาที่คุณรับทราบ และแจ้งแค่ครั้งนี้ครั้งเดียว</p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-accent">
          {error}
        </p>
      )}
    </DialogFrame>
  );
}
