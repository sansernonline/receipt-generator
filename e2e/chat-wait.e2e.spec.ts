import fsp from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SEND_URL = "**/api/chats/*/messages";
const box = (page: Page) => page.getByRole("textbox", { name: "ข้อความ" });

test("[FR-CHAT-100] [FR-CHAT-130] the waiting status shows, the box is closed, repeated Enter sends one request, then both clear", async ({ page }, testInfo) => {
  const text = `กาแฟเย็น 3 แก้ว ${testInfo.project.name}`;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let sent = 0;
  await page.route(SEND_URL, async (route) => {
    sent += 1;
    await gate; // the answer is held, so the waiting state can be seen
    await route.continue();
  });
  await page.goto("/");

  await box(page).fill(text);
  await expect(page.getByRole("button", { name: "ส่ง", exact: true })).toBeEnabled(); // enabled = the chat list has loaded
  await box(page).press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText(/กำลังทำ/);
  await expect(box(page)).toBeDisabled();
  release();
  await expect(page.getByRole("status")).toBeEmpty({ timeout: 20_000 });
  await expect(box(page)).toBeEnabled();
  await expect(box(page)).toBeFocused();
  await expect(page.getByRole("region", { name: "บทสนทนา" }).getByText(text, { exact: true })).toHaveCount(1);
  expect(sent).toBe(1);
});

test("[FR-CHAT-100] without an AI key the reply is a Thai notice in the chat and the box works again", async ({ page }, testInfo) => {
  await page.goto("/");

  await box(page).fill(`ทดสอบ ${testInfo.project.name}`);
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "ติดต่อบริการ AI ไม่ได้" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status")).toBeEmpty();
  await expect(box(page)).toBeEnabled();
});

test.describe("first-time AI notice", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // a browser that has never accepted

  const logFile = path.resolve("test-results", "e2e-data", "consent-log.json");
  const countEntries = async () => (await fsp.readFile(logFile, "utf8").then(JSON.parse, () => [])).length as number;

  test("[NFR-PDPA-030] [NFR-PDPA-040] the notice shows before the first send, one entry is saved, and it does not show again", async ({ page }, testInfo) => {
    const before = await countEntries();
    let sent = 0;
    await page.route(SEND_URL, async (route) => {
      sent += 1;
      await route.continue();
    });
    await page.goto("/");
    await box(page).fill(`ครั้งแรก ${testInfo.project.name}`);
    await expect(page.getByRole("button", { name: "ส่ง", exact: true })).toBeEnabled(); // enabled = the chat list has loaded
    await page.getByRole("button", { name: "ส่ง", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "ก่อนส่งข้อมูลให้ AI" });
    await expect(dialog).toContainText("Typhoon");
    expect(sent).toBe(0);
    await dialog.getByRole("button", { name: "รับทราบและส่งต่อ" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toBeEmpty({ timeout: 20_000 });
    expect(sent).toBe(1);
    expect(await countEntries()).toBe(before + 1);

    await box(page).fill("ข้อความที่สอง");
    await page.getByRole("button", { name: "ส่ง", exact: true }).click();
    await expect(page.getByRole("status")).toBeEmpty({ timeout: 20_000 });
    await expect(dialog).toHaveCount(0);
    expect(await countEntries()).toBe(before + 1);
  });

  test("[NFR-PDPA-030] cancel closes the notice, sends nothing and keeps the text; Esc does the same", async ({ page }) => {
    let sent = 0;
    await page.route(SEND_URL, async (route) => {
      sent += 1;
      await route.continue();
    });
    await page.goto("/");
    await box(page).fill("ยังไม่ส่ง");
    await expect(page.getByRole("button", { name: "ส่ง", exact: true })).toBeEnabled();
    await box(page).press("Enter");
    const dialog = page.getByRole("dialog", { name: "ก่อนส่งข้อมูลให้ AI" });

    await dialog.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(box(page)).toBeFocused();
    await box(page).press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(dialog).toHaveCount(0);
    await expect(box(page)).toHaveValue("ยังไม่ส่ง");
    expect(sent).toBe(0);
  });
});
