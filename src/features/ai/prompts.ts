import { P004_SYSTEM, P005_GUARD, P006_RETRY } from "./prompt-texts";

export const PROMPT_ID = "P-004";
export const PROMPT_VERSION = "0.2";

export function buildSystem(canary: string): string {
  return P004_SYSTEM.replace("{{GUARD}}", P005_GUARD.replace("{{canary}}", canary));
}

// "today" is in Bangkok time so "tomorrow" means the same day as for the user
export const bangkokDate = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);

export function buildUserMessage(parts: { today: string; draft: unknown; userText: string }): string {
  return [
    `วันนี้: ${parts.today}`,
    "<draft>",
    JSON.stringify(parts.draft),
    "</draft>",
    "<history>",
    "</history>",
    "<user_message>",
    parts.userText,
    "</user_message>",
  ].join("\n");
}

export function buildRetryMessage(userMessage: string, errors: string[]): string {
  return `${userMessage}\n${P006_RETRY.replace("{{validation_errors}}", errors.join("\n"))}`;
}
