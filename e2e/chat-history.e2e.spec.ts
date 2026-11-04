import { expect, test } from "@playwright/test";

const list = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "รายการแชต" });

test("[TC-CHAT-012] a chat with 6 messages opens complete from the list in a brand new browser context", async ({ browser, page }, testInfo) => {
  const title = `ประวัติหกข้อความ ${testInfo.project.name}`; // unique per browser: both share one data folder
  await page.goto("/");
  for (const text of [title, "สอง", "สาม", "สี่", "ห้า", "หก"]) {
    await page.getByRole("textbox", { name: "ข้อความ" }).fill(text);
    await page.getByRole("button", { name: "ส่ง", exact: true }).click();
    await expect(page.getByRole("region", { name: "บทสนทนา" }).getByText(text, { exact: true })).toBeVisible({ timeout: 20_000 });
  }

  const fresh = await (await browser.newContext({ baseURL: testInfo.project.use.baseURL })).newPage();
  await fresh.goto("/");
  await list(fresh).getByRole("button", { name: title }).click();

  await expect(fresh.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(fresh.getByRole("region", { name: "บทสนทนา" }).locator("p")).toHaveText([title, "สอง", "สาม", "สี่", "ห้า", "หก"]);
  await fresh.context().close();
});

// the bill preview, the draft net total and the version list are built in later rows (FR-DOC, FR-CHAT-090 UI)
test.fixme("[TC-CHAT-012] step 2: the preview shows net total 295.00 and versions v1 v2 after reopening", () => {});

test("[NFR-COMP-020] at 390 px the chat list is behind the menu button, which opens it with a working new chat button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(list(page)).toBeHidden();

  await page.getByRole("button", { name: "เปิดประวัติแชต" }).click();
  await expect(list(page)).toBeVisible();
  await page.getByRole("complementary", { name: "ประวัติแชต" }).getByRole("button", { name: "แชตใหม่", exact: true }).first().click();

  await expect(list(page)).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("แชตใหม่");
});
