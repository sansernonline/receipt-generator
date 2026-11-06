"use client";

import { type PointerEvent, useRef, useState } from "react";
import type { LogoCrop } from "./types";

/** The logo the user cut from the sample picture: a small PNG for the bill, and where it was cut (in pixels of the original, FR-HDR-260). */
export type LogoPick = { dataUrl: string; crop: LogoCrop };

type Props = { sample: string; logo: LogoPick | null; isUsed: boolean; onPick: (pick: LogoPick) => void; onToggle: () => void };
type Point = { x: number; y: number };

const MIN_DRAG_PX = 8; // a smaller drag is a click, not a crop
const MAX_LOGO_SIDE = 400; // the saved logo is shrunk to this: a logo on a bill never needs more

// the server refuses a logo over 512 KB (shop-request.ts); as base64 text that is about this many characters
const MAX_LOGO_CHARS = 680_000;
const SHRINK = 0.7;
const MIN_LOGO_SIDE = 16;

// shrinks the logo again until it fits what the server takes; null = no canvas, or it cannot be made small enough
function cropToPng(image: HTMLImageElement, [x, y, width, height]: LogoCrop): string | null {
  for (let scale = Math.min(1, MAX_LOGO_SIDE / Math.max(width, height)); scale * Math.min(width, height) >= MIN_LOGO_SIDE; scale *= SHRINK) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length <= MAX_LOGO_CHARS) return dataUrl;
  }
  return null;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/**
 * The typhoon-ocr model gives no place for the logo (ARCH R-04), so the user drags a box on the sample picture.
 * The same box can be typed as numbers (keyboard users; WCAG 2.1.1 and 2.5.7). A picture with no logo is simply left alone.
 */
export function LogoPicker({ sample, logo, isUsed, onPick, onToggle }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null);
  const [numbers, setNumbers] = useState({ x: "", y: "", width: "", height: "" });
  const [numbersError, setNumbersError] = useState<string | null>(null);

  function pick(crop: LogoCrop) {
    const dataUrl = imageRef.current && cropToPng(imageRef.current, crop);
    if (dataUrl) onPick({ dataUrl, crop });
  }

  function cutByNumbers() {
    const image = imageRef.current;
    const [x, y, width, height] = [numbers.x, numbers.y, numbers.width, numbers.height].map(Number);
    const isWhole = [x, y, width, height].every(Number.isInteger) && x >= 0 && y >= 0 && width >= 1 && height >= 1;
    const isInside = !!image && x + width <= image.naturalWidth && y + height <= image.naturalHeight;
    setNumbersError(isWhole && isInside ? null : "กรอบเกินขนาดรูปหรือตัวเลขไม่ถูกต้อง ใส่เป็นจำนวนเต็มพิกเซล กว้างและสูงอย่างน้อย 1");
    if (isWhole && isInside) pick([x, y, width, height]);
  }

  function pointOf(event: PointerEvent): Point {
    const rect = imageRef.current!.getBoundingClientRect();
    return { x: clamp(event.clientX - rect.left, rect.width), y: clamp(event.clientY - rect.top, rect.height) };
  }

  function start(event: PointerEvent) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointOf(event);
    setDrag({ from: point, to: point });
  }

  function finish() {
    const image = imageRef.current;
    const box = drag && boxOf(drag);
    setDrag(null);
    if (!image || !box || box.width < MIN_DRAG_PX || box.height < MIN_DRAG_PX) return;
    const [scaleX, scaleY] = [image.naturalWidth / image.clientWidth, image.naturalHeight / image.clientHeight];
    const crop: LogoCrop = [Math.round(box.x * scaleX), Math.round(box.y * scaleY), Math.max(1, Math.round(box.width * scaleX)), Math.max(1, Math.round(box.height * scaleY))];
    pick(crop);
  }

  const box = drag && boxOf(drag);
  return (
    <div className="grid gap-2 sm:col-span-2">
      <p className="text-xs text-ink-2">ถ้ามีโลโก้ ลากกรอบครอบโลโก้บนรูปได้ ถ้าไม่มีข้ามได้เลย</p>
      <div className="relative w-fit max-w-full touch-none select-none">
        {/* the picture is the user's own file (an object URL), so next/image has nothing to optimise */}
        <img ref={imageRef} src={sample} alt="รูปบิลตัวอย่าง" draggable={false} onPointerDown={start} onPointerMove={(event) => drag && setDrag({ ...drag, to: pointOf(event) })} onPointerUp={finish} onPointerCancel={() => setDrag(null)} className="block max-h-56 max-w-full cursor-crosshair rounded-[10px] border border-line" />
        {box && <div aria-hidden="true" style={{ left: box.x, top: box.y, width: box.width, height: box.height }} className="pointer-events-none absolute border-2 border-accent" />}
      </div>
      <fieldset className="grid grid-cols-2 gap-2 text-xs text-ink-2 sm:grid-cols-4">
        <legend className="mb-1">หรือใส่ตำแหน่งกรอบเป็นตัวเลข (พิกเซลของรูปจริง)</legend>
        {([["x", "ซ้าย (px)"], ["y", "บน (px)"], ["width", "กว้าง (px)"], ["height", "สูง (px)"]] as const).map(([key, label]) => (
          <label key={key} className="grid gap-1">
            {label}
            <input type="number" inputMode="numeric" min={0} value={numbers[key]} onChange={(event) => setNumbers({ ...numbers, [key]: event.target.value })} className="h-9 w-full min-w-0 rounded-[10px] border border-line-2 bg-white px-2 text-ink" />
          </label>
        ))}
        <button type="button" onClick={cutByNumbers} className="h-8 self-end rounded-full border border-line-2 px-3 hover:bg-surface-2 col-span-2 sm:col-span-4 sm:justify-self-start">
          ตัดโลโก้ตามตัวเลข
        </button>
        {numbersError && (
          <p role="alert" className="col-span-2 text-err sm:col-span-4">
            {numbersError}
          </p>
        )}
      </fieldset>
      {logo && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
          <img src={logo.dataUrl} alt="โลโก้ที่ตัดจากรูป" className={`max-h-12 max-w-24 rounded border border-line object-contain ${isUsed ? "" : "opacity-40"}`} />
          <span>โลโก้ที่ตัดจากรูป: {isUsed ? "ใช้" : "ไม่ใช้"}</span>
          <button type="button" onClick={onToggle} className="h-8 rounded-full border border-line-2 px-3 hover:bg-surface-2">
            {isUsed ? "ไม่ใช้โลโก้" : "ใช้โลโก้"}
          </button>
        </div>
      )}
    </div>
  );
}

const boxOf = ({ from, to }: { from: Point; to: Point }) => ({ x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) });
