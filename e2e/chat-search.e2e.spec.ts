import { expect, test } from "@playwright/test";

test("[TC-CHAT-023] [TC-CHAT-025] the search box narrows the list, shows a not-found message, and treats special characters as letters", async ({ page }, testInfo) => {
  const title = `ค้นหาร้านชาไทย ${testInfo.project.name}`; // unique per browser: both share one data folder
  await page.goto("/");
  await page.getByRole("textbox", { name: "ข้อความ" }).fill(title);
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title, { timeout: 20_000 });
  const list = page.getByRole("navigation", { name: "รายการแชต" });
  const box = page.getByRole("searchbox", { name: "ค้นหาแชต" });

  await box.fill(title);
  await expect(list.getByRole("listitem")).toHaveText([title]);

  await box.fill("ไม่มีคำนี้เลยจริงๆ");
  await expect(list.getByRole("status")).toContainText("ไม่พบแชตที่มี “ไม่มีคำนี้เลยจริงๆ”");

  // other tests share the data folder (one title holds "("), so only check: no regex error, and this title does not match
  for (const special of [".*", "(", "["]) {
    await box.fill(special);
    await expect(list.getByRole("button", { name: title })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  }

  await list.getByRole("button", { name: "ล้างคำค้น" }).click();
  await expect(box).toHaveValue("");
  await expect(list.getByRole("button", { name: title })).toBeVisible();
});

test("[NFR-COMP-020] at 390 px the search box inside the history drawer filters the list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "เปิดประวัติแชต" }).click();
  await page.getByRole("searchbox", { name: "ค้นหาแชต" }).fill("ไม่มีคำนี้เลยจริงๆ");

  await expect(page.getByRole("status")).toContainText("ไม่พบแชตที่มี");
});
