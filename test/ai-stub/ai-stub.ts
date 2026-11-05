import http from "node:http";
import type { AddressInfo } from "node:net";

// Fake AI service (TESTPLAN 3.3): same wire format as the real one, answers from a script, records every request.
export type Behavior =
  | { content: string; delayMs?: number }
  | { status: number; body?: string }
  | { drop: true }
  | { hang: true };

export type Kind = "text" | "ocr";
export type RecordedRequest = { kind: Kind; model: string; body: any; authorization: string | undefined };

export type AiStub = {
  baseUrl: string;
  requests: RecordedRequest[];
  /** The behaviours answer calls in order; the last one repeats. No script = HTTP 500. */
  script: (kind: Kind, ...behaviors: Behavior[]) => void;
  count: (kind: Kind) => number;
  close: () => Promise<void>;
};

export const reply = (value: unknown): Behavior => ({ content: typeof value === "string" ? value : JSON.stringify(value) });

export async function startAiStub(ocrModel = "typhoon-ocr"): Promise<AiStub> {
  const scripts: Record<Kind, Behavior[]> = { text: [], ocr: [] };
  const served: Record<Kind, number> = { text: 0, ocr: 0 };
  const requests: RecordedRequest[] = [];

  const server = http.createServer(async (req, res) => {
    const body = JSON.parse(await readBody(req));
    const kind: Kind = body.model === ocrModel ? "ocr" : "text";
    requests.push({ kind, model: body.model, body, authorization: req.headers.authorization });
    const list = scripts[kind];
    const behavior = list[Math.min(served[kind]++, list.length - 1)] ?? { status: 500 };
    await respond(behavior, req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    requests,
    script: (kind, ...behaviors) => {
      scripts[kind] = behaviors;
      served[kind] = 0;
    },
    count: (kind) => requests.filter((r) => r.kind === kind).length,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

async function respond(behavior: Behavior, req: http.IncomingMessage, res: http.ServerResponse) {
  if ("hang" in behavior) return;
  if ("drop" in behavior) return void req.socket.destroy();
  if ("status" in behavior) {
    res.writeHead(behavior.status, { "content-type": "application/json" });
    return void res.end(behavior.body ?? "{}");
  }
  if (behavior.delayMs) await new Promise((r) => setTimeout(r, behavior.delayMs));
  if (res.destroyed) return;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: behavior.content } }] }));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
