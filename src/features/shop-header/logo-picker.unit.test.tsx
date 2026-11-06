import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LogoPicker } from "./logo-picker";

// jsdom has no canvas and no picture decoding: the picture is 300 x 200 and the canvas answers from a script
let dataUrls: string[];
let drawn: { width: number; height: number }[];

beforeEach(() => {
  dataUrls = ["data:image/png;base64,AAAA"];
  drawn = [];
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(200);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement) {
    drawn.push({ width: this.width, height: this.height });
    return dataUrls.length > 1 ? dataUrls.shift()! : dataUrls[0];
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const setup = () => {
  const onPick = vi.fn();
  render(<LogoPicker sample="blob:sample" logo={null} isUsed onPick={onPick} onToggle={() => undefined} />);
  return onPick;
};
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = (x: string, y: string, width: string, height: string) => {
  type(/ซ้าย/, x);
  type(/บน/, y);
  type(/กว้าง/, width);
  type(/สูง/, height);
};

test("[FR-HDR-050] the logo can be cut with the keyboard: numbers for the box, one button to cut", () => {
  const onPick = setup();

  fill("10", "20", "100", "50");
  fireEvent.click(screen.getByRole("button", { name: "ตัดโลโก้ตามตัวเลข" }));

  expect(onPick).toHaveBeenCalledWith({ dataUrl: "data:image/png;base64,AAAA", crop: [10, 20, 100, 50] });
});

test("[FR-HDR-050] a box outside the picture is refused with a Thai text and nothing is cut", () => {
  const onPick = setup();

  fill("250", "20", "100", "50");
  fireEvent.click(screen.getByRole("button", { name: "ตัดโลโก้ตามตัวเลข" }));

  expect(screen.getByRole("alert")).toHaveTextContent("กรอบเกินขนาดรูป");
  expect(onPick).not.toHaveBeenCalled();
});

test("[FR-HDR-050] an empty or zero-size box is refused", () => {
  const onPick = setup();

  fill("10", "20", "0", "50");
  fireEvent.click(screen.getByRole("button", { name: "ตัดโลโก้ตามตัวเลข" }));

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(onPick).not.toHaveBeenCalled();
});

test("[FR-HDR-170] a logo too big to save is shrunk again in the browser until it fits", () => {
  dataUrls = ["x".repeat(700_000), "x".repeat(700_000), "data:image/png;base64,SMALL"];
  const onPick = setup();

  fill("0", "0", "300", "200");
  fireEvent.click(screen.getByRole("button", { name: "ตัดโลโก้ตามตัวเลข" }));

  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ dataUrl: "data:image/png;base64,SMALL", crop: [0, 0, 300, 200] }));
  expect(drawn[2].width).toBeLessThan(drawn[0].width);
});
