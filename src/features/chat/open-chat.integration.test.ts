import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { POST as createChatRoute } from "@/app/api/chats/route";
import { POST as sendRoute } from "@/app/api/chats/[id]/messages/route";
import { GET } from "@/app/api/chats/[id]/route";

let rootDir: string;
let dataDir: string;
const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };
const open = (id: string) => GET(new Request(`http://localhost/api/chats/${id}`), { params: Promise.resolve({ id }) });
const newChatId = async () => (await (await createChatRoute(new Request("http://localhost/api/chats", { method: "POST", headers }))).json()).chat.id as string;
const send = (id: string, text: string) =>
  sendRoute(new Request("http://localhost/x", { method: "POST", headers, body: JSON.stringify({ text }) }), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-open-"));
  dataDir = path.join(rootDir, "data");
  await fsp.mkdir(dataDir);
  process.env.BILLGEN_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(rootDir, { recursive: true, force: true });
});

describe("GET /api/chats/[id]", () => {
  test("[FR-CHAT-050] opens a chat with every message in order and the draft", async () => {
    const id = await newChatId();
    for (const text of ["หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก"]) await send(id, text);

    const res = await open(id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chat.messages.map((m: { text: string }) => m.text)).toEqual(["หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก"]);
    expect(body.chat).toMatchObject({ id, title: "หนึ่ง", shopId: null });
    expect(body.draft).toEqual({ items: [], bill: { customerName: null, billNumber: null } });
  });

  test("[TC-CHAT-013] a random id that is not stored gets 404 with a Thai message and no stack or path", async () => {
    const res = await open("33333333-3333-4333-8333-333333333333");
    const text = await res.text();

    expect(res.status).toBe(404);
    expect(JSON.parse(text)).toEqual({ error: "ไม่พบแชตนี้" });
    expect(text).not.toMatch(/billgen-open|ENOENT|\bat \w|\\|chat\.json/);
  });

  test.each([["../secret.txt"], ["..%2F..%2Fsecret.txt"], ["..\\..\\secret.txt"], ["%2e%2e/%2e%2e/secret.txt"]])(
    "[TC-CHAT-014] chat id %s is refused and secret.txt is never returned",
    async (id) => {
      await fsp.writeFile(path.join(rootDir, "secret.txt"), "TOP-SECRET-CONTENT");
      await fsp.writeFile(path.join(dataDir, "secret.txt"), "TOP-SECRET-CONTENT");

      const res = await open(id);
      const text = await res.text();

      expect([400, 404]).toContain(res.status);
      expect(text).not.toContain("TOP-SECRET-CONTENT");
    },
  );

  test("a damaged chat.json gives a generic Thai error with no path or stack", async () => {
    const id = await newChatId();
    await fsp.writeFile(path.join(dataDir, "chats", id, "chat.json"), "{broken");

    const res = await open(id);
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toMatch(/billgen-open|SyntaxError|\bat \w|\\/);
  });
});
