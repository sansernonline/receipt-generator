import { expect, test } from "@playwright/test";

test("[FR-CHAT-020] new chat button adds an empty selected chat that survives reload", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "แชตใหม่" }).click();

  const newest = page.getByRole("navigation", { name: "รายการแชต" }).getByRole("listitem").first();
  await expect(newest).toHaveText("แชตใหม่");
  await expect(newest).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("textbox", { name: "ข้อความ" })).toHaveValue("");

  await page.reload();

  await expect(page.getByRole("navigation", { name: "รายการแชต" }).getByRole("listitem").first()).toHaveText("แชตใหม่");
});
