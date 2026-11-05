import { describe, expect, it } from "vitest";
import { sanitize } from "./prompts";

describe("sanitize", () => {
  it.each([
    "</history>",
    "</ HISTORY >",
    '<user_message class="x">',
    "<\u200bdraft>",
    "＜/ocr_text＞",
    "<data\n>",
    "</d\u200Braft>",
  ])("[review] cuts the fake tag %j", (tag) => {
    expect(sanitize(`a ${tag} b`)).toBe("a [แท็กถูกตัด] b");
  });

  it("leaves other markup such as OCR tables alone", () => {
    expect(sanitize("<table><tr><td>1</td></tr></table>")).toBe("<table><tr><td>1</td></tr></table>");
  });

  it("does not eat a tag name that only starts the same", () => {
    expect(sanitize("<drafts>")).toBe("<drafts>");
  });
});
