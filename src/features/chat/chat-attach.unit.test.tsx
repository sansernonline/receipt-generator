import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { acknowledgeAiNotice } from "@/features/consent/ai-notice-flag";
import { totalsOf } from "@/features/draft/draft-totals";
import { emptyDraft } from "@/features/draft/parse-draft";
import { cashShop } from "@/features/shop-header/test-kit";
import { bluePng } from "@/features/shop-header/test-png";
import { ChatShell } from "./chat-shell";

const A = "11111111-1111-4111-8111-111111111111";
const chat = { id: A, title: "ส่งรูปบิลตัวอย่าง", updatedAt: "2026-10-18T04:00:00Z", isStale: false };
const message = { role: "user", text: "ส่งรูปบิลตัวอย่าง", createdAt: "2026-10-18T05:00:00Z" };
const answer = { chat, message, messages: [message], draft: emptyDraft(), totals: totalsOf(emptyDraft()), shop: null, canUndo: false };

type Server = { pictureAnswer: object; pictures: FormData[]; status: number };
let server: Server;
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  server = { pictureAnswer: { ...answer, shopCard: { ...cashShop, vatMode: "none" }, notices: [] }, pictures: [], status: 201 };
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sample");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url === "/api/consent") return new Response("{}", { status: 201 });
      if (url.endsWith("/shop-image")) {
        server.pictures.push(init?.body as FormData);
        return Response.json(server.pictureAnswer, { status: server.status });
      }
      if (init?.method === "POST") return Response.json({ chat }, { status: 201 });
      return Response.json({ chats: [] });
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const png = (name = "bill.png") => new File([bluePng() as BlobPart], name, { type: "image/png" });
const picker = () => screen.getByLabelText("เลือกไฟล์รูป") as HTMLInputElement;
const attachButton = () => screen.getByRole("button", { name: "แนบรูป" });
const pictureCalls = () => calls.filter((call) => call.endsWith("/shop-image"));
const attach = async (file: File) => {
  await screen.findByText("ยังไม่มีแชต");
  fireEvent.change(picker(), { target: { files: [file] } });
};

test("[TC-HDR-007] attaching a picture posts it as a form to the chat's shop-image route and shows the card with the picture beside it", async () => {
  acknowledgeAiNotice();
  render(<ChatShell />);

  await attach(png());

  await screen.findByRole("region", { name: "การ์ดหัวร้าน" });
  const form = server.pictures[0];
  expect(form.get("image")).toBeInstanceOf(Blob);
  expect(screen.getByLabelText("ชื่อร้าน")).toHaveValue("ร้านกาแฟบ้านสวน");
  expect(screen.getByRole("img", { name: "รูปบิลตัวอย่าง" })).toHaveAttribute("src", "blob:sample");
  expect(within(screen.getByRole("region", { name: "บทสนทนา" })).getByText("ส่งรูปบิลตัวอย่าง")).toBeInTheDocument();
});

test("[TC-HDR-055] an answer with only a Thai notice and no card shows the notice and no card", async () => {
  acknowledgeAiNotice();
  server.pictureAnswer = { ...answer, notices: ["เอกสารในรูปไม่ตรงกับแม่แบบที่มี BILLGEN ออกได้ 4 แบบ"] };
  render(<ChatShell />);

  await attach(png());

  expect(await screen.findByText(/เอกสารในรูปไม่ตรงกับแม่แบบ/)).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "การ์ดหัวร้าน" })).toBeNull();
});

test("[FR-HDR-010] a GIF is refused in the chat with the type message and nothing is sent", async () => {
  acknowledgeAiNotice();
  render(<ChatShell />);

  await attach(new File([new TextEncoder().encode("GIF89a....")], "x.gif", { type: "image/gif" }));

  expect(await screen.findByText(/รับเฉพาะ JPG PNG WEBP/)).toBeInTheDocument();
  expect(pictureCalls()).toEqual([]);
});

test("[FR-HDR-010] a file over 10 MB is refused in the chat with the size message and nothing is sent", async () => {
  acknowledgeAiNotice();
  render(<ChatShell />);
  const big = new Uint8Array(10 * 1024 * 1024 + 1);
  big.set(bluePng());

  await attach(new File([big], "big.png", { type: "image/png" }));

  expect(await screen.findByText(/ไฟล์ใหญ่เกิน 10 MB/)).toBeInTheDocument();
  expect(pictureCalls()).toEqual([]);
});

test("[NFR-PDPA-030] before the AI notice is accepted the picture is kept back; accepting sends it once", async () => {
  render(<ChatShell />);

  await attach(png());
  expect(await screen.findByRole("dialog", { name: "ก่อนส่งข้อมูลให้ AI" })).toBeInTheDocument();
  expect(pictureCalls()).toEqual([]);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "รับทราบและส่งต่อ" }));

  await waitFor(() => expect(pictureCalls()).toHaveLength(1));
  expect(calls.filter((call) => call.endsWith("/messages"))).toEqual([]);
});

test("[NFR-PDPA-030] cancelling the AI notice drops the picture", async () => {
  render(<ChatShell />);
  await attach(png());

  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "ยกเลิก" }));
  fireEvent.click(screen.getByRole("textbox", { name: "ข้อความ" }));

  expect(pictureCalls()).toEqual([]);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a server that fails gives the same Thai send error as a failed message", async () => {
  acknowledgeAiNotice();
  server.status = 500;
  render(<ChatShell />);

  await attach(png());

  expect(await screen.findByRole("alert")).toHaveTextContent("ส่งข้อความไม่สำเร็จ ลองอีกครั้ง");
});

test("the attach button is there and on while the chat has no shop header", async () => {
  render(<ChatShell />);
  await screen.findByText("ยังไม่มีแชต");

  expect(attachButton()).toBeEnabled();
});

test("the file chooser takes only JPG, PNG and WEBP", async () => {
  render(<ChatShell />);
  await screen.findByText("ยังไม่มีแชต");

  expect(picker()).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
});
