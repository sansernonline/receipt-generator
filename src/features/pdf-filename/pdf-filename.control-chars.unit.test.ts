import { expect, it } from "vitest";
import { pdfFileName } from "./pdf-filename";

it("replaces control characters in the bill number, which Windows rejects in file names", () => {
  expect(pdfFileName("A\nB\u0000C", 2, true)).toBe("A-B-C_v2.pdf");
});
