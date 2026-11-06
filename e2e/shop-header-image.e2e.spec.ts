import { expect, test, type Page } from "@playwright/test";
import { bluePng } from "../src/features/shop-header/test-png";

const PICTURE_URL = "**/api/chats/*/shop-image";
const card = { shopName: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี", taxId: "", phone: "038-123456", email: "", template: "receipt", vatMode: "exclusive" };

const emptyBill = { customerName: null, customerAddress: null, customerTaxId: null, customerPhone: null, customerEmail: null, billNumber: null, billDate: null, ref: null, dueDate: null, quoteRef: null, quotedBy: null };
const footer = { vat: { mode: "none", rate: 7 }, discount: null, paymentMethod: null, paymentDate: null, paymentDetail: null, remarks: null };
const totals = { lines: [], subtotal: 0, billDiscount: 0, afterDiscount: 0, priceBeforeTax: 0, vat: 0, net: 0 };

// The AI is not reachable in e2e, so the server's answer to the picture is faked (it echoes the accent the browser sent);
// the picture, the colour finding, the crop, the shop save and the bill use the real browser and the real server.
async function openCardFromPicture(page: Page): Promise<{ accent: () => string | null; chatId: () => string }> {
  let accent: string | null = null;
  let chatId = "";
  await page.route(PICTURE_URL, (route) => {
    const id = (chatId = new URL(route.request().url()).pathname.split("/")[3]);
    accent = /name="accent"\r\n\r\n(#[0-9a-f]{6})/.exec(route.request().postDataBuffer()?.toString("latin1") ?? "")?.[1] ?? null;
    const message = { role: "user", text: "ส่งรูปบิลตัวอย่าง", createdAt: "2026-10-18T05:00:00Z" };
    return route.fulfill({
      status: 201,
      json: { chat: { id, title: "ส่งรูปบิลตัวอย่าง", updatedAt: "2026-10-18T05:00:00Z" }, message, messages: [message], draft: { items: [], bill: emptyBill, footer }, totals, shop: null, shopCard: { ...card, ...(accent ? { accent } : {}) }, notices: [] },
    });
  });
  await page.goto("/");
  await page.getByLabel("เลือกไฟล์รูป").setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: bluePng(200) });
  await expect(page.getByRole("region", { name: "การ์ดหัวร้าน" })).toBeVisible();
  return { accent: () => accent, chatId: () => chatId };
}

const preview = (page: Page) => page.getByRole("region", { name: "ตัวอย่างบิล" });
const useButton = (page: Page) => page.getByRole("button", { name: "ใช้หัวบิลนี้" });

async function dragLogo(page: Page) {
  const picture = page.getByRole("img", { name: "รูปบิลตัวอย่าง" });
  await expect(picture).toHaveJSProperty("complete", true); // the box is measured only once the picture has its size
  await picture.scrollIntoViewIfNeeded(); // the mouse works in screen coordinates, so the whole picture must be on screen
  const box = (await picture.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 70, { steps: 4 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("[TC-HDR-016] the browser finds the blue of the picture's top band and the bill uses it", async ({ page }) => {
  const sent = await openCardFromPicture(page);

  const [r, g, b] = [1, 3, 5].map((i) => parseInt(sent.accent()!.slice(i, i + 2), 16));
  expect(Math.abs(r - 0x1f) + Math.abs(g - 0x4e) + Math.abs(b - 0x9c)).toBeLessThanOrEqual(12);
  await expect(page.getByText(`สีเน้น ${sent.accent()}`)).toBeVisible();
  await useButton(page).click();
  const paper = preview(page).getByRole("article", { name: "ใบเสร็จรับเงิน" });
  await expect(paper).toBeVisible();
  expect(await paper.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--color-accent"))).toBe(sent.accent());
});

test("[TC-HDR-017] a file the browser cannot decode as a picture is sent, with no accent, and the card still comes", async ({ page }) => {
  let accentField = true;
  await page.route(PICTURE_URL, (route) => {
    accentField = (route.request().postDataBuffer()?.toString("latin1") ?? "").includes('name="accent"');
    const id = new URL(route.request().url()).pathname.split("/")[3];
    const message = { role: "user", text: "ส่งรูปบิลตัวอย่าง", createdAt: "2026-10-18T05:00:00Z" };
    return route.fulfill({ status: 201, json: { chat: { id, title: "x", updatedAt: "2026-10-18T05:00:00Z" }, message, messages: [message], draft: { items: [], bill: emptyBill, footer }, totals, shop: null, shopCard: card, notices: [] } });
  });
  await page.goto("/");
  const damaged = Buffer.concat([bluePng(40).subarray(0, 60), Buffer.from("garbage after the header")]); // a PNG whose data is cut and broken

  await page.getByLabel("เลือกไฟล์รูป").setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: damaged });

  await expect(page.getByRole("region", { name: "การ์ดหัวร้าน" })).toBeVisible();
  expect(accentField).toBe(false);
});

test("[FR-HDR-050] dragging a box on the picture cuts a logo; it is saved with the shop and shows on the bill, also after a reload", async ({ page }) => {
  await openCardFromPicture(page);

  await dragLogo(page);
  await expect(page.getByRole("img", { name: "โลโก้ที่ตัดจากรูป" })).toHaveAttribute("src", /^data:image\/png;base64,/);
  await useButton(page).click();

  await expect(preview(page).getByRole("img", { name: "โลโก้ร้าน" })).toBeVisible();
  await page.reload();
  await page.getByRole("navigation", { name: "รายการแชต" }).getByRole("listitem").first().getByRole("button").click();
  await expect(preview(page).getByRole("img", { name: "โลโก้ร้าน" })).toBeVisible();
});

test("[TC-HDR-049] ไม่ใช้โลโก้ then ใช้หัวบิลนี้: the bill has no logo", async ({ page }) => {
  await openCardFromPicture(page);
  await dragLogo(page);

  await page.getByRole("button", { name: "ไม่ใช้โลโก้" }).click();
  await useButton(page).click();

  await expect(preview(page).getByRole("article", { name: "ใบเสร็จรับเงิน" }).getByText("ร้านกาแฟบ้านสวน")).toBeVisible();
  await expect(preview(page).getByRole("img", { name: "โลโก้ร้าน" })).toHaveCount(0);
});

test("[TC-HDR-019] a picture with no box dragged: no logo picture and no ไม่ใช้โลโก้ button on the card", async ({ page }) => {
  await openCardFromPicture(page);

  await expect(page.getByRole("img", { name: "โลโก้ที่ตัดจากรูป" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ไม่ใช้โลโก้" })).toHaveCount(0);
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
