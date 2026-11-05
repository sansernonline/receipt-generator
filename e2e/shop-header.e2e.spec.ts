import { expect, test, type Page } from "@playwright/test";

const SEND_URL = "**/api/chats/*/messages";
const SHOP_URL = "**/api/chats/*/shop";
const TEXT = "ร้านกาแฟบ้านสวน 12/3 ถ.สุขุมวิท ชลบุรี โทร 038-123456 ออกบิลเงินสด";
const card = { shopName: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี", taxId: "", phone: "038-123456", email: "", template: "cash" };

const emptyBill = { customerName: null, customerAddress: null, customerTaxId: null, customerPhone: null, customerEmail: null, billNumber: null, billDate: null, ref: null, dueDate: null, quoteRef: null, quotedBy: null };
const footer = { vat: { mode: "none", rate: 7 }, discount: null, paymentMethod: null, paymentDate: null, paymentDetail: null, remarks: null };
const totals = { lines: [], subtotal: 0, billDiscount: 0, afterDiscount: 0, priceBeforeTax: 0, vat: 0, net: 0 };

// The message answer is faked (the AI is not reachable in e2e); the chat, the shop save and the bill reload use the real server.
async function answerWithCard(page: Page) {
  await page.route(SEND_URL, (route) => {
    const id = new URL(route.request().url()).pathname.split("/")[3];
    const message = { role: "user", text: TEXT, createdAt: "2026-10-18T05:00:00Z" };
    return route.fulfill({
      status: 201,
      json: { chat: { id, title: "ร้านกาแฟบ้านสวน", updatedAt: "2026-10-18T05:00:00Z" }, message, messages: [message], draft: { items: [], bill: emptyBill, footer }, totals, shop: null, shopCard: card, notices: [] },
    });
  });
}

async function openCard(page: Page) {
  await answerWithCard(page);
  await page.goto("/");
  // no chat is open: sending the first message makes the chat, so this works the same on a phone where the list is a drawer
  await page.getByRole("button", { name: "พิมพ์ข้อมูลร้าน" }).click();
  await page.getByRole("button", { name: "ส่ง", exact: true }).click();
  await expect(page.getByRole("region", { name: "การ์ดหัวร้าน" })).toBeVisible();
}

const preview = (page: Page) => page.getByRole("region", { name: "ตัวอย่างบิล" });
const useButton = (page: Page) => page.getByRole("button", { name: "ใช้หัวบิลนี้" });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("[TC-HDR-022] the bill has no shop name until ใช้หัวบิลนี้ is pressed, then it has, and it is still there after a reload", async ({ page }) => {
  await openCard(page);
  await expect(page.getByLabel("ชื่อร้าน")).toHaveValue("ร้านกาแฟบ้านสวน");
  await expect(preview(page).getByText("ร้านกาแฟบ้านสวน")).toHaveCount(0);

  await useButton(page).click();

  await expect(preview(page).getByRole("article", { name: "บิลเงินสด" }).getByText("ร้านกาแฟบ้านสวน")).toBeVisible();
  await expect(useButton(page)).toHaveCount(0);
  await page.reload();
  await page.getByRole("navigation", { name: "รายการแชต" }).getByRole("listitem").first().getByRole("button").click(); // newest first: the chat just made
  await expect(preview(page).getByText("ร้านกาแฟบ้านสวน")).toBeVisible();
});

test("[TC-HDR-024] an address edited in the card is the address on the bill", async ({ page }) => {
  await openCard(page);

  await page.getByLabel("ที่อยู่").fill("99/9 ถ.พระยาสัจจา ชลบุรี");
  await useButton(page).click();

  await expect(preview(page).getByText("99/9 ถ.พระยาสัจจา ชลบุรี")).toBeVisible();
  await expect(preview(page).getByText("12/3 ถ.สุขุมวิท ชลบุรี")).toHaveCount(0);
});

test("[TC-HDR-025] a 12-digit tax id is refused on the card: nothing is sent and the bill has no shop", async ({ page }) => {
  let saves = 0;
  await page.route(SHOP_URL, (route) => {
    saves += 1;
    return route.continue();
  });
  await openCard(page);

  await page.getByLabel("เลขประจำตัวผู้เสียภาษี").fill("010556000000");
  await useButton(page).click();

  await expect(page.getByText("เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก")).toBeVisible();
  await expect(page.getByLabel("เลขประจำตัวผู้เสียภาษี")).toBeFocused();
  expect(saves).toBe(0);
  await expect(preview(page).getByText("ร้านกาแฟบ้านสวน")).toHaveCount(0);
});

test("[TC-HDR-025] 13 digits with a wrong check digit shows a warning and can still be used", async ({ page }) => {
  await openCard(page);

  await page.getByLabel("เลขประจำตัวผู้เสียภาษี").fill("0105560000001");
  await expect(page.getByText(/หลักที่ 13 ไม่ตรงกับการคำนวณ/)).toBeVisible();
  await useButton(page).click();

  await expect(preview(page).getByText("เลขประจำตัวผู้เสียภาษี 0105560000001")).toBeVisible();
});

test("[TC-HDR-022] on a phone the card fits the screen and the shop shows on the bill tab", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCard(page);

  await useButton(page).click();
  await page.getByRole("button", { name: "บิล", exact: true }).click();

  await expect(preview(page).getByText("ร้านกาแฟบ้านสวน")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
