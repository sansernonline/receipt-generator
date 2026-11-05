import { expect, test } from "@playwright/test";

test("[TC-CHAT-015] renaming from the chat menu changes the list and survives reload; 81 characters are refused", async ({ page }, testInfo) => {
  const first = `ชื่อเดิม ${testInfo.project.name}`; // unique per browser: both share one data folder
  const renamed = `บิลคุณสมชาย ${testInfo.project.name}`;
  await page.goto("/");
  await page.getByRole("textbox", { name: "ข้อความ" }).fill(first);
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(first, { timeout: 20_000 });

  await page.getByRole("button", { name: "เมนูแชต" }).click();
  await page.getByRole("menuitem", { name: "เปลี่ยนชื่อแชต" }).click();
  const dialog = page.getByRole("dialog", { name: "เปลี่ยนชื่อแชต" });
  await dialog.getByRole("textbox", { name: "ชื่อแชต" }).fill("ก".repeat(81));
  await expect(dialog.getByText("ชื่อยาวได้ไม่เกิน 80 ตัวอักษร")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "บันทึกชื่อ" })).toBeDisabled();
  await dialog.getByRole("textbox", { name: "ชื่อแชต" }).fill(renamed);
  await dialog.getByRole("button", { name: "บันทึกชื่อ" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamed);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "รายการแชต" }).getByRole("button", { name: renamed })).toBeVisible();
});
