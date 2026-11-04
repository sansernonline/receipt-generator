import { expect, test } from "@playwright/test";

test("[FR-CHAT-110] a new chat shows the first-stage chips and พิมพ์ข้อมูลร้าน fills the message box", async ({ page }) => {
  await page.goto("/");

  const chips = page.getByRole("group", { name: "คำสั่งด่วน" });
  await expect(chips.getByRole("button", { name: "ส่งรูปบิลตัวอย่าง" })).toBeDisabled();
  await chips.getByRole("button", { name: "พิมพ์ข้อมูลร้าน" }).click();

  await expect(page.getByRole("textbox", { name: "ข้อความ" })).toHaveValue(/^ร้านกาแฟบ้านสวน/);
  await expect(page.getByRole("textbox", { name: "ข้อความ" })).toBeFocused();
});
