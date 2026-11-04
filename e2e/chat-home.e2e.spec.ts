import { expect, test } from "@playwright/test";

test("[TC-CHAT-001] home page opens straight into the chat, no mode selection", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("textbox", { name: "ข้อความ" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "รายการแชต" })).toBeVisible();
  await expect(page.getByText(/โหมด/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /โหมด/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /โหมด/ })).toHaveCount(0);
});
