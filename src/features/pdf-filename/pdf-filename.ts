// the 9 characters FR-DOC-080 names, plus control characters (0-31) which Windows rejects too
// eslint-disable-next-line no-control-regex
const WINDOWS_ILLEGAL_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

// FR-DOC-080: a draft that was never issued has no version number, so it uses "draft"
export function pdfFileName(billNumber: string, version: number, isIssued: boolean): string {
  const safeNumber = billNumber.replace(WINDOWS_ILLEGAL_CHARS, "-");
  const suffix = isIssued ? `v${version}` : "draft";
  return `${safeNumber}_${suffix}.pdf`;
}
