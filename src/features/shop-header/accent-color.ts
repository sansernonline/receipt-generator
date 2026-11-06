import { decodePixels } from "./decode-pixels";

const MIN_CHROMA = 40; // below this a pixel is white, grey or black: paper and text, not a brand colour
const MIN_CONTRAST = 4.5; // against white paper (WCAG AA for text): a paler colour would not read as the title or the total
const MIN_ALPHA = 128;

const linear = (channel: number) => (channel / 255 <= 0.03928 ? channel / 255 / 12.92 : ((channel / 255 + 0.055) / 1.055) ** 2.4);
// WCAG contrast of a colour against white: 1.05 / (relative luminance + 0.05)
const contrastWithWhite = (r: number, g: number, b: number) => 1.05 / (0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) + 0.05);

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** The colour most of the picture's coloured pixels share, as #rrggbb. null = nothing coloured enough (white, grey, black, transparent). */
export function dominantColor(rgba: ArrayLike<number>): string | null {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>(); // 16 levels per channel
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const isColoured = Math.max(r, g, b) - Math.min(r, g, b) >= MIN_CHROMA && contrastWithWhite(r, g, b) >= MIN_CONTRAST;
    if (rgba[i + 3] < MIN_ALPHA || !isColoured) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { count: bucket.count + 1, r: bucket.r + r, g: bucket.g + g, b: bucket.b + b });
  }
  const best = [...buckets.values()].reduce<{ count: number; r: number; g: number; b: number } | null>((top, bucket) => (!top || bucket.count > top.count ? bucket : top), null);
  return best && `#${hex(best.r / best.count)}${hex(best.g / best.count)}${hex(best.b / best.count)}`;
}

/** The accent of a picture the user attached (FR-HDR-040). A picture that cannot be read gives null: the template keeps its own colour. */
export async function accentFromFile(file: Blob, decode: (file: Blob) => Promise<ArrayLike<number>> = decodePixels): Promise<string | null> {
  try {
    return dominantColor(await decode(file));
  } catch {
    return null;
  }
}
