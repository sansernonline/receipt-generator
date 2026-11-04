import { expect, test } from "@playwright/test";

test("[placeholder-e2e] home page opens", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Bill Gen" })).toBeVisible();
});
