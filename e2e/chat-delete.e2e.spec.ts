import { expect, test, type Page } from "@playwright/test";

const list = (page: Page) => page.getByRole("navigation", { name: "รายการแชต" });

async function startChatWith(page: Page, text: string) {
  const items = list(page).getByRole("listitem");
  const newChat = page.getByRole("button", { name: "แชตใหม่", exact: true }).first(); // list items can carry the same name
  await expect(newChat).toBeEnabled(); // enabled again = the list has loaded
  const before = await items.count();
  await newChat.click();
  await expect(items).toHaveCount(before + 1); // the new chat is listed once it is created; the box is cleared then, so type after
  await page.getByRole("textbox", { name: "ข้อความ" }).fill(text);
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(text, { timeout: 20_000 });
}

test("[TC-CHAT-019] [TC-CHAT-021] cancel keeps the chat; confirm in the box removes only that chat, also after reload", async ({ page }, testInfo) => {
  const gone = `แชตที่จะลบ ${testInfo.project.name}`; // unique per browser: both share one data folder
  const kept = `แชตที่เก็บไว้ ${testInfo.project.name}`;
  await page.goto("/");
  await startChatWith(page, gone);
  await startChatWith(page, kept);
  await list(page).getByRole("button", { name: gone }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(gone);
  const before = await list(page).getByRole("listitem").count();

  await page.getByRole("button", { name: "เมนูแชต" }).click();
  await page.getByRole("menuitem", { name: "ลบแชต" }).click();
  const dialog = page.getByRole("dialog", { name: "ลบแชตนี้?" });
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();

  await expect(dialog).toBeHidden();
  await expect(list(page).getByRole("listitem")).toHaveCount(before);
  await expect(page.getByRole("region", { name: "บทสนทนา" })).toContainText(gone);

  await page.getByRole("button", { name: "เมนูแชต" }).click();
  await page.getByRole("menuitem", { name: "ลบแชต" }).click();
  await dialog.getByRole("button", { name: "ลบแชต" }).click();

  await expect(list(page).getByRole("listitem")).toHaveCount(before - 1);
  await expect(list(page).getByRole("button", { name: gone })).toHaveCount(0);
  await expect(list(page).getByRole("button", { name: kept })).toBeVisible();
  await page.reload();
  await expect(list(page).getByRole("button", { name: kept })).toBeVisible();
  await expect(list(page).getByRole("button", { name: gone })).toHaveCount(0);
});

test("[TC-CHAT-020] typing ลบแชตนี้ in the chat does not delete the chat", async ({ page }, testInfo) => {
  const title = `ลบแชตนี้ ${testInfo.project.name}`;
  await page.goto("/");
  await startChatWith(page, title);

  await page.reload();

  await expect(list(page).getByRole("button", { name: title })).toBeVisible();
});
