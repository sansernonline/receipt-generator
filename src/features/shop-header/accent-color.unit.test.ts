import { describe, expect, it } from "vitest";
import { accentFromFile, dominantColor } from "./accent-color";

// pixels of a made-up picture: width x height, the first `bandRows` rows in `band`, the rest `rest`
function picture(width: number, height: number, bandRows: number, band: number[], rest: number[]): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) rgba.set([...(Math.floor(i / width) < bandRows ? band : rest), 255], i * 4);
  return rgba;
}

const BLUE = [0x1f, 0x4e, 0x9c];
const WHITE = [255, 255, 255];
const GREY = [128, 128, 128];

// CIE76: straight distance in L*a*b*; the SRS does not say which formula, the simplest one is used (TC-HDR-016)
function lab(hex: string): number[] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const [fx, fy, fz] = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

describe("dominantColor", () => {
  it("[TC-HDR-016] a picture with a #1F4E9C band on the top half gives a blue within ΔE 10 of it", () => {
    const accent = dominantColor(picture(8, 8, 4, BLUE, WHITE));

    expect(accent).not.toBeNull();
    expect(deltaE(accent!, "#1f4e9c")).toBeLessThanOrEqual(10);
  });

  it("[TC-HDR-016] the blue still wins when it is a smaller part of the picture", () => {
    const accent = dominantColor(picture(8, 8, 2, BLUE, WHITE));

    expect(deltaE(accent!, "#1f4e9c")).toBeLessThanOrEqual(10);
  });

  it("[TC-HDR-017] a white picture gives no accent, so the template colour stays", () => {
    expect(dominantColor(picture(8, 8, 0, WHITE, WHITE))).toBeNull();
  });

  it("[TC-HDR-017] a grey picture gives no accent", () => {
    expect(dominantColor(picture(8, 8, 8, GREY, GREY))).toBeNull();
  });

  it("black text on white paper gives no accent", () => {
    expect(dominantColor(picture(8, 8, 3, [0, 0, 0], WHITE))).toBeNull();
  });

  it("a bright yellow is left out: its contrast with white paper is about 1.3 to 1", () => {
    expect(dominantColor(picture(8, 8, 8, [0xff, 0xe6, 0x00], [0xff, 0xe6, 0x00]))).toBeNull();
  });

  it("a normal brand red still passes", () => {
    expect(dominantColor(picture(8, 8, 8, [0xc0, 0x1c, 0x28], WHITE))).toBe("#c01c28");
  });

  it("a very pale colour is left out: it would not read on white paper", () => {
    expect(dominantColor(picture(8, 8, 8, [255, 250, 205], [255, 250, 205]))).toBeNull();
  });

  it("transparent pixels are not counted", () => {
    const rgba = picture(4, 4, 4, BLUE, WHITE);
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 0;

    expect(dominantColor(rgba)).toBeNull();
  });

  it("an empty picture gives no accent", () => {
    expect(dominantColor(new Uint8ClampedArray(0))).toBeNull();
  });
});

describe("accentFromFile", () => {
  const file = new Blob([new Uint8Array([1, 2, 3])]);

  it("[TC-HDR-016] takes the pixels the browser decoded and returns their dominant colour", async () => {
    const accent = await accentFromFile(file, async () => picture(8, 8, 4, BLUE, WHITE));

    expect(deltaE(accent!, "#1f4e9c")).toBeLessThanOrEqual(10);
  });

  it("[TC-HDR-017] a picture the browser cannot decode (damaged PNG) gives no accent and no error", async () => {
    const damaged = async () => {
      throw new Error("The source image cannot be decoded");
    };

    expect(await accentFromFile(file, damaged)).toBeNull();
  });
});
