import { expect, test } from "@playwright/test";

test("[FR-CHAT-030] the first message names the chat, HTML stays text, and the title survives reload", async ({ page, request }, testInfo) => {
  const text = `<script>alert(1)</script> ร้าน ${testInfo.project.name}`; // unique per browser: both share one data folder
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => dialogs.push(dialog.message()));
  // next dev compiles a route on first use and can reload the page meanwhile; compile it before the UI flow
  await request.post("/api/chats/11111111-1111-4111-8111-111111111111/messages", { data: { text: "x" }, headers: { origin: "http://127.0.0.1:3100" } });
  await page.goto("/");

  await page.getByRole("textbox", { name: "ข้อความ" }).fill(text);
  await page.getByRole("button", { name: "ส่ง" }).click();

  const item = page.getByRole("navigation", { name: "รายการแชต" }).getByRole("listitem").filter({ hasText: text });
  await expect(item).toHaveText(text, { timeout: 20_000 }); // the first send can wait on a slow dev compile
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(text);
  await expect(page.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("");

  await page.reload();

  await expect(item).toHaveText(text);
  expect(dialogs).toEqual([]);
});
