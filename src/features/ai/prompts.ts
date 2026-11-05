import { randomBytes } from "node:crypto";
import type { ChatTurn } from "./types";
import { P004_SYSTEM, P005_GUARD, P006_RETRY } from "./prompt-texts";

export const PROMPT_ID = "P-004";
export const PROMPT_VERSION = "0.2";

export function buildSystem(canary: string): string {
  return P004_SYSTEM.replace("{{GUARD}}", P005_GUARD.replace("{{canary}}", canary));
}

// "today" is in Bangkok time so "tomorrow" means the same day as for the user
export const bangkokDate = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);

export const MAX_HISTORY = 10; // FR-AI-040
// Random per server start (P-005 {{canary}}): if it shows up in a reply, the system prompt leaked
export const SERVER_CANARY = randomBytes(8).toString("hex");
// First line of the system prompt: a reply that repeats it is a leak too
export const SYSTEM_PROMPT_MARKER = "คุณคือตัวแปลคำสั่งของแอปออกบิลภาษาไทย BILLGEN";
export const OCR_INSTRUCTION = "Extract all text from this image as Markdown.";
export const DEFAULT_IMAGE_REQUEST = "เพิ่มรายการจากข้อความที่อ่านจากรูป";

// Text that looks like one of our data tags could close the block early and write instructions after it (PROMPT-LIBRARY 2.2)
const FAKE_TAG = /<\/?\s*(ocr_text|draft|history|user_message|data)\s*>/gi;
export const sanitize = (text: string) => text.replace(FAKE_TAG, "[แท็กถูกตัด]");

const speaker = (turn: ChatTurn) => (turn.role === "user" ? "ผู้ใช้" : "ระบบ");
const historyLine = (turn: ChatTurn) => `${speaker(turn)}: ${sanitize(turn.text)}`;

/** Last 10 messages, fewer when they would not fit in the character budget (oldest dropped first). */
export function fitHistory(history: ChatTurn[], budgetChars: number): ChatTurn[] {
  const kept = history.slice(-MAX_HISTORY);
  while (kept.length && kept.reduce((sum, t) => sum + historyLine(t).length + 1, 0) > budgetChars) kept.shift();
  return kept;
}

export type UserMessageParts = { today: string; draft: unknown; history: ChatTurn[]; ocrText?: string; userText: string };

export function buildUserMessage(parts: UserMessageParts): string {
  const ocr = parts.ocrText === undefined ? [] : ["<ocr_text>", sanitize(parts.ocrText), "</ocr_text>"];
  return [
    `วันนี้: ${parts.today}`,
    "<draft>",
    sanitize(JSON.stringify(parts.draft)),
    "</draft>",
    "<history>",
    ...parts.history.map(historyLine),
    "</history>",
    ...ocr,
    "<user_message>",
    sanitize(parts.userText),
    "</user_message>",
  ].join("\n");
}

export function buildRetryMessage(userMessage: string, errors: string[]): string {
  return `${userMessage}\n${P006_RETRY.replace("{{validation_errors}}", errors.join("\n"))}`;
}
