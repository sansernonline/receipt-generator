"use client";

import { type PointerEvent, useRef, useState } from "react";
import type { LogoCrop } from "./types";

/** The logo the user cut from the sample picture: a small PNG for the bill, and where it was cut (in pixels of the original, FR-HDR-260). */
export type LogoPick = { dataUrl: string; crop: LogoCrop };

type Props = { sample: string; logo: LogoPick | null; isUsed: boolean; onPick: (pick: LogoPick) => void; onToggle: () => void };
type Point = { x: number; y: number };

const MIN_DRAG_PX = 8; // a smaller drag is a click, not a crop
const MAX_LOGO_SIDE = 400; // the saved logo is shrunk to this: a logo on a bill never needs more

function cropToPng(image: HTMLImageElement, [x, y, width, height]: LogoCrop): string | null {
  const scale = Math.min(1, MAX_LOGO_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/**
 * The typhoon-ocr model gives no place for the logo (ARCH R-04), so the user drags a box on the sample picture.
 * simple: pointer only; a picture with no logo is simply left alone.
 */
export function LogoPicker({ sample, logo, isUsed, onPick, onToggle }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null);

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
    const dataUrl = cropToPng(image, crop);
    if (dataUrl) onPick({ dataUrl, crop });
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
