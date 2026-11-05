import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as getChat, PATCH as renameChat } from "@/app/api/chats/[id]/route";
import { POST as postMessage } from "@/app/api/chats/[id]/messages/route";
import { GET as getChats, POST as postChat } from "@/app/api/chats/route";
import { KEY, okReply, useAiStub } from "@/features/ai/test-kit";
import { acknowledgeAiNotice } from "@/features/consent/ai-notice-flag";
import { confirmShop } from "@/features/shop-header/shop-store";
import { cashShop } from "@/features/shop-header/test-kit";
import { createStore } from "@/features/storage/store";
import { ChatShell } from "./chat-shell";

const { state } = useAiStub();
const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };
const realFetch = globalThis.fetch;
const TEXT = "กาแฟเย็น 3 แก้ว 55 บาท";
let dataDir: string;

// the browser's calls go to the real route handlers; the calls from the server to the fake AI keep their real network path
function routeToHandlers(url: string, init: RequestInit = {}) {
  if (!url.startsWith("/")) return realFetch(url, init);
  const request = new Request(`http://localhost${url}`, { ...init, headers });
  const params = { params: Promise.resolve({ id: url.split("/")[3] }) };
  if (url.endsWith("/messages")) return postMessage(request, params);
  if (url === "/api/chats") return init.method === "POST" ? postChat(request) : getChats();
  return getChat(request, params);
}

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-wait-"));
  Object.assign(process.env, { BILLGEN_DATA_DIR: dataDir, AI_BASE_URL: state.stub.baseUrl, AI_API_KEY: KEY });
  acknowledgeAiNotice();
  vi.stubGlobal("fetch", vi.fn(routeToHandlers));
});

afterEach(async () => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  for (const name of ["BILLGEN_DATA_DIR", "AI_BASE_URL", "AI_API_KEY"]) delete process.env[name];
  await fsp.rm(dataDir, { recursive: true, force: true });
});

test("[TC-CHAT-036] pressing Enter 3 more times while the AI is slow makes one message and one AI request", async () => {
  state.stub.script("text", { ...okReply(), delayMs: 1_000 });
  // a chat with a confirmed shop header: without one the message would be read as shop info (FR-HDR-060)
  const { chat } = await (await postChat(new Request("http://localhost/api/chats", { method: "POST", headers }))).json();
  await confirmShop(createStore(dataDir), chat.id, cashShop);
  await renameChat(new Request(`http://localhost/api/chats/${chat.id}`, { method: "PATCH", headers, body: JSON.stringify({ title: "ร้านทดสอบ" }) }), { params: Promise.resolve({ id: chat.id }) });
  render(<ChatShell />);
  fireEvent.click(await screen.findByRole("button", { name: "ร้านทดสอบ" }));
  await screen.findByRole("heading", { name: "ร้านทดสอบ" }); // the chat is open: opening it clears the box, so type after
  const box = screen.getByRole("textbox", { name: "ข้อความ" });
  fireEvent.change(box, { target: { value: TEXT } });
  await waitFor(() => expect(screen.getByRole("button", { name: "ส่ง" })).toBeEnabled()); // enabled = the chat list has loaded

  for (let press = 0; press < 4; press++) fireEvent.keyDown(box, { key: "Enter" });

  expect(box).toBeDisabled();
  await screen.findByText("เพิ่มน้ำเปล่าแล้ว", {}, { timeout: 5_000 });
  expect(screen.getAllByText(TEXT, { selector: "p" })).toHaveLength(1);
  expect(state.stub.count("text")).toBe(1);
});
