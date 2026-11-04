import { describe, expect, it } from "vitest";
import { pdfFileName } from "./pdf-filename";

describe("pdfFileName", () => {
  it("[TC-DOC-020] should name RC/2569:0042 v2 as RC-2569-0042_v2.pdf", () => {
    expect(pdfFileName("RC/2569:0042", 2, true)).toBe("RC-2569-0042_v2.pdf");
  });

  it("[TC-DOC-021] should name A*B?1 v1 as A-B-1_v1.pdf", () => {
    expect(pdfFileName("A*B?1", 1, true)).toBe("A-B-1_v1.pdf");
  });

  it("[TC-DOC-022] should end with _draft when the bill was never issued", () => {
    expect(pdfFileName("RC-2569-0042", 1, false)).toBe("RC-2569-0042_draft.pdf");
  });

  it("[TC-DOC-023] should replace all 9 Windows-illegal characters with a dash", () => {
    expect(pdfFileName('A\\B/C:D*E?F"G<H>I|J', 1, true)).toBe("A-B-C-D-E-F-G-H-I-J_v1.pdf");
  });

  it("[TC-DOC-024] should leave no path separator for ..-..-evil input", () => {
    expect(pdfFileName("..\\..\\evil", 1, true)).toBe("..-..-evil_v1.pdf");
  });

  it("should keep Thai characters", () => {
    expect(pdfFileName("ใบเสร็จ/๐๐๔๒", 1, true)).toBe("ใบเสร็จ-๐๐๔๒_v1.pdf");
  });

  it.todo("empty bill number fallback (SRS/TC-DOC-024 title mention it but give no expected name) (รอยืนยัน)");
  it.todo("length limit and reserved names such as CON/NUL (SRS gives none) (รอยืนยัน)");
});
