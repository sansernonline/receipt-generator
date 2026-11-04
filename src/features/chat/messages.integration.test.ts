import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GET, POST as createChatRoute } from "@/app/api/chats/route";
import { POST } from "@/app/api/chats/[id]/messages/route";

let dataDir: string;
const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };
const send = (id: string, body: unknown, extra: Record<string, string> = {}) =>
  POST(new Request(`http://localhost/api/chats/${id}/messages`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
const newChatId = async () => (await (await createChatRoute(new Request("http://localhost/api/chats", { method: "POST", headers }))).json()).chat.id as string;
const readChat = async (id: string) => JSON.parse(await fsp.readFile(path.join(dataDir, "chats", id, "chat.json"), "utf8"));
const listedTitle = async () => (await (await GET()).json()).chats[0].title;

beforeEach(async () => {
  dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "billgen-messages-"));
  process.env.BILLGEN_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.BILLGEN_DATA_DIR;
  await fsp.rm(dataDir, { recursive: true, force: true });
});

describe("POST /api/chats/[id]/messages", () => {
  test("[TC-CHAT-005] the first message becomes the title in chat.json and in the list", async () => {
    const id = await newChatId();

    const res = await send(id, { text: "ออกบิลร้านกาแฟบ้านสวน ให้คุณสมชาย กาแฟเย็น 3 แก้ว 55 บาท" });

    expect(res.status).toBe(201);
    expect((await readChat(id)).title).toBe("ออกบิลร้านกาแฟบ้านสวน ให้คุณสมชาย กาแฟเย็น 3");
    expect(await listedTitle()).toBe("ออกบิลร้านกาแฟบ้านสวน ให้คุณสมชาย กาแฟเย็น 3");
  });

  test("[TC-CHAT-008] HTML in the first message is stored and listed as literal text", async () => {
    const id = await newChatId();

    await send(id, { text: "<script>alert(1)</script> ร้านกาแฟ" });

    expect(await listedTitle()).toBe("<script>alert(1)</script> ร้านกาแฟ");
  });

  test("a second message is kept in order and does not change the title", async () => {
    const id = await newChatId();
    await send(id, { text: "ข้อความแรก" });

    await send(id, { text: "ข้อความสอง" });

    const chat = await readChat(id);
    expect(chat.title).toBe("ข้อความแรก");
    expect(chat.messages.map((m: { role: string; text: string }) => [m.role, m.text])).toEqual([["user", "ข้อความแรก"], ["user", "ข้อความสอง"]]);
  });

  test("a new message updates updatedAt", async () => {
    const id = await newChatId();
    const before = (await readChat(id)).updatedAt;
    await new Promise((r) => setTimeout(r, 5));

    await send(id, { text: "สวัสดี" });

    expect((await readChat(id)).updatedAt > before).toBe(true);
  });

  test.each([["http://evil.example"], ["null"]])("rejects Origin %s with 403 and stores nothing", async (origin) => {
    const id = await newChatId();

    const res = await send(id, { text: "x" }, { origin });

    expect(res.status).toBe(403);
    expect((await readChat(id)).messages).toEqual([]);
  });

  test.each([["../secret.txt"], ["..%2F..%2Fsecret.txt"], ["not-a-uuid"]])("refuses chat id %s with 400", async (id) => {
    const res = await send(id, { text: "x" });

    expect(res.status).toBe(400);
  });

  test("answers 404 with a Thai message for an unknown chat", async () => {
    const res = await send("11111111-1111-4111-8111-111111111111", { text: "x" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "ไม่พบแชตนี้" });
  });

  test.each([[{}], [{ text: 5 }], [{ text: "   " }], [{ text: "ก".repeat(10_001) }]])("rejects body %j with 400", async (body) => {
    const id = await newChatId();

    const res = await send(id, body);

    expect(res.status).toBe(400);
    expect((await readChat(id)).messages).toEqual([]);
  });

  test("a body that is not JSON gets 400, not 500", async () => {
    const id = await newChatId();

    const res = await POST(new Request("http://localhost/x", { method: "POST", headers, body: "{oops" }), { params: Promise.resolve({ id }) });

    expect(res.status).toBe(400);
  });

  test("a damaged chat.json gives a generic Thai error with no path or stack", async () => {
    const id = await newChatId();
    await fsp.writeFile(path.join(dataDir, "chats", id, "chat.json"), "{broken");

    const res = await send(id, { text: "x" });

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/billgen-messages|SyntaxError|at /);
  });
});
