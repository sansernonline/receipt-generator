import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import { POST } from "@/app/api/chats/[id]/messages/route";
import { POST as undoRoute } from "@/app/api/chats/[id]/undo/route";
import { KEY, useAiStub } from "@/features/ai/test-kit";
import { createChat } from "@/features/chat/chats";
import { confirmShop } from "@/features/shop-header/shop-store";
import { cashShop } from "@/features/shop-header/test-kit";
import { createStore } from "@/features/storage/store";
import type { Draft, SendMessageResponse } from "./types";

const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };

/**
 * A chat on disk that starts with `startDraft`, a fake AI service, and send() that posts a message to the real route.
 * The chat has a confirmed shop header unless `hasShop` is false: without one a message is read as shop info (FR-HDR-060).
 */
export function useChatWithDraft(startDraft: () => Draft, { hasShop = true } = {}) {
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
    if (hasShop) await confirmShop(store, chatId, cashShop);
  });

  afterEach(async () => {
    for (const name of ["BILLGEN_DATA_DIR", "AI_BASE_URL", "AI_API_KEY"]) delete process.env[name];
    await fsp.rm(dataDir, { recursive: true, force: true });
  });

  async function send(text: string): Promise<SendMessageResponse> {
    const request = new Request(`http://localhost/api/chats/${chatId}/messages`, { method: "POST", headers, body: JSON.stringify({ text }) });
    return (await POST(request, { params: Promise.resolve({ id: chatId }) })).json();
  }
  async function undo() {
    const request = new Request(`http://localhost/api/chats/${chatId}/undo`, { method: "POST", headers });
    const res = await undoRoute(request, { params: Promise.resolve({ id: chatId }) });
    return { status: res.status, body: await res.json() };
  }
  const readDraftFile = async () => JSON.parse(await fsp.readFile(draftPath(), "utf8")) as Draft;
  const readChatFile = async () => JSON.parse(await fsp.readFile(path.join(dataDir, "chats", chatId, "chat.json"), "utf8"));
  return { stub: () => state.stub, send, undo, readDraftFile, readChatFile, dataDir: () => dataDir, chatId: () => chatId };
}
