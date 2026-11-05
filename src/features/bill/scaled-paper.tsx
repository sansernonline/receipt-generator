import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// on a narrow screen the sheet is laid out at 400 / 440 px instead of the real paper width, so the text is not shrunk to nothing (mockup fit())
const NARROW_FRAME_PX = 560;
const NARROW_SHEET_PX = 440;
const TINY_FRAME_PX = 400;
const TINY_SHEET_PX = 400;

type Fit = { sheetWidth: number; scale: number; height: number };

/** Lays the sheet out at its logical width and shrinks it with a transform to fit the panel; never enlarges. */
export function ScaledPaper({ paperWidth, children }: { paperWidth: number; children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>({ sheetWidth: paperWidth, scale: 1, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const sheet = sheetRef.current;
    if (!frame || !sheet || typeof ResizeObserver === "undefined") return; // jsdom has none: the sheet stays at full size
    const measure = () => {
      const frameWidth = frame.clientWidth;
      const sheetWidth = frameWidth < TINY_FRAME_PX ? TINY_SHEET_PX : frameWidth < NARROW_FRAME_PX ? NARROW_SHEET_PX : paperWidth;
      setFit({ sheetWidth, scale: Math.min(1, frameWidth / sheetWidth), height: sheet.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [paperWidth]);

  return (
    <div ref={frameRef} className="w-full min-w-0">
      <div className="mx-auto" style={{ width: fit.sheetWidth * fit.scale, height: fit.height ? fit.height * fit.scale : undefined }}>
        <div ref={sheetRef} style={{ width: fit.sheetWidth, transform: `scale(${fit.scale})`, transformOrigin: "0 0" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
