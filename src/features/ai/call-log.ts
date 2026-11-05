import { AiCallError } from "./connector";
import type { AiLogEntry } from "./types";

export type LogContext = { log: (entry: AiLogEntry) => void; now: () => Date };
export type CallMeta = { chatId: string; promptId: string; promptVersion?: string; model: string };

/**
 * Runs one AI call and writes one row for it (FR-AI-100 · NFR-COST-010).
 * A row holds ids, model, time and outcome only: no key, no message text, no AI output.
 */
export async function logged<T>(ctx: LogContext, meta: CallMeta, run: () => Promise<T>, outcomeOf: (result: T) => AiLogEntry["outcome"] = () => "ok"): Promise<T> {
  const started = Date.now();
  const write = (outcome: AiLogEntry["outcome"]) =>
    ctx.log({ at: ctx.now().toISOString(), event: "call", ...meta, durationMs: Date.now() - started, outcome });
  try {
    const result = await run();
    write(outcomeOf(result));
    return result;
  } catch (error) {
    if (error instanceof AiCallError) write(error.failure);
    throw error;
  }
}

export const logLeak = (ctx: LogContext, chatId: string) => ctx.log({ at: ctx.now().toISOString(), event: "leak", chatId });
