import type { ReactNode } from "react";

/** A value the bill needs but the draft does not have yet. */
export const Missing = ({ children }: { children: ReactNode }) => <span className="border-b border-dashed border-[#b42318] text-[#b42318]">{children}</span>;
