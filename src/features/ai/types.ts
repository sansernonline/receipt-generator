import type { ImageLimiter } from "./image-limiter";

export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  modelText: string;
  modelOcr: string;
  /** Ceiling shared by prompt and answer (ARCH R-03); real value not measured yet. */
  maxTokens: number;
  timeoutMs: number;
};

export type AiLogEntry = {
  at: string;
  event: "call" | "leak";
  chatId?: string;
  promptId?: string;
  promptVersion?: string;
  model?: string;
  durationMs?: number;
  outcome?: "ok" | "schema_fail" | "timeout" | "rate_limited" | "server_error" | "network_error" | "bad_response";
};

export type Operation = { op: string } & Record<string, unknown>;

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type ImageInput = { mimeType: string; data: Uint8Array };

export type AskAiInput = {
  chatId: string;
  userText: string;
  /** Compact draft without shop header or totals (PROMPT-LIBRARY P-004 {{draft}}). */
  draft: { items: { line: number }[] } & Record<string, unknown>;
  chatHistory?: ChatTurn[];
  images?: ImageInput[];
};

export type AskAiDeps = {
  config: AiConfig;
  fetch?: typeof fetch;
  log?: (entry: AiLogEntry) => void;
  now?: () => Date;
  canary?: string;
  /** Default: one counter for the whole server process (FR-AI-090). */
  imageLimiter?: ImageLimiter;
};

export type AskAiFailure = "message_too_long" | "rate_limited" | "ai_unreachable" | "invalid_reply" | "refused" | "leak";

/** ok:true = operations may be applied (empty + reply = a question for the user). ok:false = draft stays as it is. */
export type AskAiResult =
  | { ok: true; operations: Operation[]; reply: string }
  | { ok: false; code: AskAiFailure; userMessage: string };
