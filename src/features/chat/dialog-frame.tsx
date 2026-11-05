import { useEffect, type ReactNode } from "react";

type Props = { title: string; footer: ReactNode; onClose: () => void; children: ReactNode };

// simple: no focus trap yet; Escape and a click on the dark area close it (mockup .dlg)
export function DialogFrame({ title, footer, onClose, children }: Props) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div onClick={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="font-head text-base font-semibold">{title}</h2>
        <div className="mt-3 text-sm">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
