import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/chats/[id]/messages/route";
import { KEY, useAiStub } from "@/features/ai/test-kit";
import { createChat } from "@/features/chat/chats";
import { createStore } from "@/features/storage/store";
import type { Draft, SendMessageResponse } from "./types";

const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };

/** A chat on disk that starts with `startDraft`, a fake AI service, and send() that posts a message to the real route. */
export function useChatWithDraft(startDraft: () => Draft) {
  const { state } = useAiStub();
  let dataDir: string;
  let chatId: string;
  const draftPath = () => path.join(dataDir, "chats", chatId, "draft.json");

  beforeEach(async () => {
    dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-draft-"));
    Object.assign(process.env, { BILLGEN_DATA_DIR: dataDir, AI_BASE_URL: state.stub.baseUrl, AI_API_KEY: KEY });
    const store = createStore(dataDir);
    chatId = (await createChat(store)).id;
    await store.writeJsonAtomic(draftPath(), startDraft());
  });

  afterEach(async () => {
    for (const name of ["BILLGEN_DATA_DIR", "AI_BASE_URL", "AI_API_KEY"]) delete process.env[name];
    await fsp.rm(dataDir, { recursive: true, force: true });
  });

  async function send(text: string): Promise<SendMessageResponse> {
    const request = new Request(`http://localhost/api/chats/${chatId}/messages`, { method: "POST", headers, body: JSON.stringify({ text }) });
    return (await POST(request, { params: Promise.resolve({ id: chatId }) })).json();
  }
  const readDraftFile = async () => JSON.parse(await fsp.readFile(draftPath(), "utf8")) as Draft;
  return { stub: () => state.stub, send, readDraftFile };
}
