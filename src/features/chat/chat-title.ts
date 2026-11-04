const MAX_TITLE_CHARS = 40; // visible characters (FR-CHAT-030)
const segmenter = new Intl.Segmenter("th", { granularity: "grapheme" });

const graphemesOf = (text: string) => Array.from(segmenter.segment(text), (part) => part.segment);

// cut at the last space inside the limit so a word is not split; no space to cut at -> hard cut at the limit
export function titleFromMessage(message: string): string {
  const chars = graphemesOf(message.replace(/\s+/g, " ").trim());
  if (chars.length <= MAX_TITLE_CHARS) return chars.join("");
  const head = chars.slice(0, MAX_TITLE_CHARS);
  const lastSpace = chars[MAX_TITLE_CHARS] === " " ? MAX_TITLE_CHARS : head.lastIndexOf(" ");
  return (lastSpace > 0 ? head.slice(0, lastSpace) : head).join("").trim();
}
