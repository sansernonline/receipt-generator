import { expect, test, type Page } from "@playwright/test";
import { bluePng } from "../src/features/shop-header/test-png";

const PICTURE_URL = "**/api/chats/*/shop-image";
const card = { shopName: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี", taxId: "", phone: "038-123456", email: "", template: "receipt", vatMode: "exclusive" };

const emptyBill = { customerName: null, customerAddress: null, customerTaxId: null, customerPhone: null, customerEmail: null, billNumber: null, billDate: null, ref: null, dueDate: null, quoteRef: null, quotedBy: null };
const footer = { vat: { mode: "none", rate: 7 }, discount: null, paymentMethod: null, paymentDate: null, paymentDetail: null, remarks: null };
const totals = { lines: [], subtotal: 0, billDiscount: 0, afterDiscount: 0, priceBeforeTax: 0, vat: 0, net: 0 };

// The AI is not reachable in e2e, so the server's answer to the picture is faked;
// the picture, the shop save and the bill use the real browser and the real server.
async function openCardFromPicture(page: Page): Promise<{ chatId: () => string }> {
  let chatId = "";
  await page.route(PICTURE_URL, (route) => {
    const id = (chatId = new URL(route.request().url()).pathname.split("/")[3]);
    const message = { role: "user", text: "ส่งรูปบิลตัวอย่าง", createdAt: "2026-10-18T05:00:00Z" };
    return route.fulfill({
      status: 201,
      json: { chat: { id, title: "ส่งรูปบิลตัวอย่าง", updatedAt: "2026-10-18T05:00:00Z" }, message, messages: [message], draft: { items: [], bill: emptyBill, footer }, totals, shop: null, shopCard: card, notices: [] },
    });
  });
  await page.goto("/");
  await page.getByLabel("เลือกไฟล์รูป").setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: bluePng(200) });
  await expect(page.getByRole("region", { name: "การ์ดหัวร้าน" })).toBeVisible();
  return { chatId: () => chatId };
}

const preview = (page: Page) => page.getByRole("region", { name: "ตัวอย่างบิล" });
const useButton = (page: Page) => page.getByRole("button", { name: "ใช้หัวบิลนี้" });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("[FR-TOT-040] the tax mode from the picture is chosen on the card and is the draft's tax mode once the card is used", async ({ page }) => {
  const sent = await openCardFromPicture(page);
  await expect(page.getByLabel("วิธีคิดภาษีเริ่มต้น")).toHaveValue("exclusive");

  await useButton(page).click();

  await expect(preview(page).getByRole("article", { name: "ใบเสร็จรับเงิน" })).toBeVisible();
  const { draft } = await (await page.request.get(`/api/chats/${sent.chatId()}/draft`)).json();
  expect(draft.footer.vat.mode).toBe("exclusive");
});

test("[FR-HDR-010] a GIF is refused in the chat before anything is sent", async ({ page }) => {
  let sent = 0;
  await page.route(PICTURE_URL, (route) => {
    sent += 1;
    return route.abort();
  });
  await page.goto("/");

  await page.getByLabel("เลือกไฟล์รูป").setInputFiles({ name: "x.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a....") });

  await expect(page.getByText(/รับเฉพาะ JPG PNG WEBP/)).toBeVisible();
  expect(sent).toBe(0);
});

test("[TC-HDR-007] on a phone the card with the picture fits the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCardFromPicture(page);

  await expect(page.getByRole("img", { name: "รูปบิลตัวอย่าง" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
