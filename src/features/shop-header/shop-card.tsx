"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { TEMPLATES, type TemplateId } from "@/features/bill/bill-templates";
import type { BillData } from "@/features/bill/types";
import { type FieldMessages, submitShop } from "./submit-shop";
import type { ShopFields, ShopProposal } from "./types";
import { checkShop, hasErrors, parseAccent } from "./validate-shop";
import type { VatMode } from "@/features/totals/types";

/* slop-ok: placeholder-label every input has a visible label from Field; the scan cannot see it through the spread props */
type Props = {
  card: ShopProposal;
  hasFollowUp: boolean;
  chatId: string;
  sample?: string; // the picture the card was read from (an object URL); none = the card came from typed text
  onUsed: (bill: BillData) => void;
};
type TextKey = "shopName" | "address" | "taxId" | "phone" | "email";

const VAT_MODES: { id: VatMode; name: string }[] = [{ id: "none", name: "ไม่มี VAT" }, { id: "inclusive", name: "รวมในราคา" }, { id: "exclusive", name: "แยกนอกราคา" }];
const UNSURE = "AI ไม่แน่ใจช่องนี้ ตรวจกับรูปอีกครั้ง";
type FieldProps = { label: string; error?: string; warning?: string; className?: string; children: (props: { id: string; describedBy?: string }) => ReactNode };

const control = "h-10 w-full min-w-0 rounded-[10px] border border-line-2 bg-white px-3 text-ink aria-invalid:border-err";

function Field({ label, error, warning, className = "", children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? warning;
  return (
    <div className={`grid min-w-0 content-start gap-1 text-xs ${className}`}>
      <label htmlFor={id} className="text-ink-2">
        {label}
      </label>
      {children({ id, describedBy: message ? messageId : undefined })}
      {message && (
        <p id={messageId} className={error ? "text-err" : "text-warn"}>
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * The shop header the AI proposed. Nothing here touches the bill: only "ใช้หัวบิลนี้" sends the fields, and the bill shows them
 * after the server has saved them (FR-HDR-070 · 080).
 */
export function ShopCard({ card, hasFollowUp, chatId, sample, onUsed }: Props) {
  const [shop, setShop] = useState<ShopProposal>(card);
  const [pressCount, setPressCount] = useState(0); // errors show from the first press; each press moves focus to the first one
  const [isSaving, setIsSaving] = useState(false);
  const [refused, setRefused] = useState<{ message: string; fields: FieldMessages } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const problems = checkShop(shop);
  const errors: FieldMessages = pressCount ? { ...problems.errors, ...refused?.fields } : {};
  const unsure = (key: keyof ShopFields) => (card.uncertain?.includes(key) ? UNSURE : undefined);
  const accent = parseAccent(card.accent);
  const edit = (key: TextKey) => (event: { target: { value: string } }) => setShop({ ...shop, [key]: event.target.value });
  const text = (key: TextKey, id: string, describedBy?: string) => ({
    id, value: shop[key], onChange: edit(key), "aria-invalid": !!errors[key], "aria-describedby": describedBy, autoComplete: "off", className: control,
  });

  useEffect(() => {
    if (pressCount) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [pressCount]);

  async function use(event: FormEvent) {
    event.preventDefault();
    setRefused(null);
    setPressCount((count) => count + 1);
    if (hasErrors(problems)) return;
    setIsSaving(true);
    const result = await submitShop(chatId, shop);
    setIsSaving(false);
    if (result.ok) onUsed(result.bill);
    else setRefused(result);
  }

  return (
    <section aria-label="การ์ดหัวร้าน" className="max-w-[92%] self-start">
      <p className="w-fit max-w-full rounded-2xl bg-surface-2 px-3 py-2">{sample ? "อ่านหัวบิลจากรูปได้แล้ว" : "ตั้งหัวร้านจากข้อความของคุณแล้ว"} ตรวจให้ตรงกับร้าน แก้ช่องไหนก็ได้ แล้วกด “ใช้หัวบิลนี้”</p>
      <form ref={formRef} onSubmit={use} noValidate className="mt-3 overflow-hidden rounded-[20px] border border-line bg-white">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <Field label="ชื่อร้าน" error={errors.shopName} warning={unsure("shopName")} className="sm:col-span-2">
            {({ id, describedBy }) => <input {...text("shopName", id, describedBy)} />}
          </Field>
          <Field label="ที่อยู่" error={errors.address} warning={unsure("address")} className="sm:col-span-2">
            {({ id, describedBy }) => <textarea {...text("address", id, describedBy)} rows={2} className={`${control} h-16 resize-none py-2`} />}
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี (13 หลัก)" error={errors.taxId} warning={problems.warnings.taxId ?? unsure("taxId")}>
            {({ id, describedBy }) => <input {...text("taxId", id, describedBy)} inputMode="numeric" placeholder="0000000000000" />}
          </Field>
          <Field label="โทรศัพท์" error={errors.phone} warning={unsure("phone")}>
            {({ id, describedBy }) => <input {...text("phone", id, describedBy)} inputMode="tel" />}
          </Field>
          <Field label="แม่แบบ / ชนิดเอกสาร" warning={unsure("template")}>
            {({ id, describedBy }) => (
              <select id={id} aria-describedby={describedBy} value={shop.template} onChange={(event) => setShop({ ...shop, template: event.target.value as TemplateId })} className={control}>
                {TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="วิธีคิดภาษีเริ่มต้น">
            {({ id }) => (
              <select id={id} value={shop.vatMode ?? "none"} onChange={(event) => setShop({ ...shop, vatMode: event.target.value as VatMode })} className={control}>
                {VAT_MODES.map(({ id: mode, name }) => (
                  <option key={mode} value={mode}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="อีเมล" error={errors.email} warning={unsure("email")}>
            {({ id, describedBy }) => <input {...text("email", id, describedBy)} inputMode="email" />}
          </Field>
          {accent && (
            <p className="flex items-center gap-2 text-xs text-ink-2 sm:col-span-2">
              <span aria-hidden="true" style={{ background: accent }} className="size-5 rounded-full border border-line-2" />
              สีเน้น {accent}
            </p>
          )}
          {/* the picture is the user's own file (an object URL), so next/image has nothing to optimise */}
          {sample && <img src={sample} alt="รูปบิลตัวอย่าง" className="max-h-56 max-w-full rounded-[10px] border border-line sm:col-span-2" />}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          <button type="submit" disabled={isSaving} className="h-10 rounded-full bg-accent-fill px-4 font-semibold text-white disabled:opacity-60">
            ใช้หัวบิลนี้
          </button>
          {refused && (
            <p role="alert" className="text-xs text-err">
              {refused.message}
            </p>
          )}
        </div>
      </form>
      <p className="mt-3 text-xs text-ink-3">
        ตัวอย่างบิลยังไม่ใช้ค่านี้ จนกว่าจะกด “ใช้หัวบิลนี้” แก้ช่องไหนก็ได้ก่อน
        {hasFollowUp && " หลังกดใช้หัวบิลนี้ ระบบจะทำรายการในข้อความเดิมต่อให้ ถ้าปิดแชตหรือโหลดหน้าใหม่ก่อน ข้อความที่เก็บไว้จะหายพร้อมการ์ด"}
      </p>
    </section>
  );
}
