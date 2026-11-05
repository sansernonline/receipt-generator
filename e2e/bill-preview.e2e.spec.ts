import fsp from "node:fs/promises";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const LIMIT_MS = 1000;
const RUNS = 20;
const SEND_URL = "**/api/chats/*/messages";
const dataDir = path.resolve("test-results", "e2e-data");
const preview = (page: Page) => page.getByRole("region", { name: "ตัวอย่างบิล" });

const line = (name: string, qty: number, unitPrice: number) => ({ code: null, name, description: null, qty, unit: "ชิ้น", unitPrice, discount: null });
const emptyBill = { customerName: null, customerAddress: null, customerTaxId: null, customerPhone: null, customerEmail: null, billNumber: null, billDate: null, ref: null, dueDate: null, quoteRef: null, quotedBy: null };
const footer = { vat: { mode: "none", rate: 7 }, discount: null, paymentMethod: null, paymentDate: null, paymentDetail: null, remarks: null };
const draftOf = (items: ReturnType<typeof line>[]) => ({ items, bill: emptyBill, footer });
// the answer a server would give for a draft without VAT or discount
function answerFor(chat: object, items: ReturnType<typeof line>[]) {
  const lines = items.map(({ qty, unitPrice }) => ({ gross: qty * unitPrice, discount: 0, amount: qty * unitPrice }));
  const net = lines.reduce((sum, { amount }) => sum + amount, 0);
  const totals = { lines, subtotal: net, billDiscount: 0, afterDiscount: net, priceBeforeTax: net, vat: 0, net };
  const message = { role: "user", text: "แก้ราคา", createdAt: "2026-10-18T05:00:00Z" };
  return { chat, message, messages: [message], draft: draftOf(items), totals, notices: [] };
}

async function newChatWithDraft(request: APIRequestContext, baseURL: string, title: string, draft: object) {
  const headers = { origin: baseURL };
  const { chat } = await (await request.post("/api/chats", { headers })).json();
  await request.patch(`/api/chats/${chat.id}`, { headers, data: { title } });
  await fsp.writeFile(path.join(dataDir, "chats", chat.id, "draft.json"), JSON.stringify(draft));
}

test("[TC-DOC-001] opening a chat that has a 2-line draft shows the bill beside the chat with net amount 295.00", async ({ page, request, baseURL }, testInfo) => {
  const title = `บิลสองบรรทัด ${testInfo.project.name}`;
  await newChatWithDraft(request, baseURL!, title, draftOf([line("กาแฟเย็น", 3, 55), line("ครัวซองต์", 2, 65)]));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByRole("navigation", { name: "รายการแชต" }).getByRole("button", { name: title }).click();

  const bill = preview(page).getByRole("article");
  await expect(bill.getByText("กาแฟเย็น")).toBeVisible();
  await expect(bill.getByText("ครัวซองต์")).toBeVisible();
  await expect(bill.getByText("295.00").first()).toBeVisible();
  await expect(preview(page).getByText("ยังไม่ออกบิล")).toBeVisible();
  await expect(bill).not.toContainText("ยังไม่ออกบิล");
});

// blocked until the shop header is stored (rows 35 · 38): TC-DOC-001 step 2 wants the shop header on the bill
test.fixme("[TC-DOC-001] step 2: the bill has the saved shop header", () => {});

test("[TC-DOC-003] a new chat shows the empty state beside the chat: no bill, no amount", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: "แชตใหม่" }).click();

  await expect(preview(page).getByText("ตัวอย่างบิลจะขึ้นที่นี่")).toBeVisible();
  await expect(preview(page).getByRole("article")).toHaveCount(0);
});

// time from the answer reaching the browser (fetch resolved) to the new price in the bill; both stamps are taken inside the page
async function measureRuns(page: Page, items: ReturnType<typeof line>[], title: string): Promise<number[]> {
  let price = 0;
  await page.route(SEND_URL, (route) => {
    const changed = items.map((item, i) => (i === 0 ? { ...item, unitPrice: price } : item));
    return route.fulfill({ status: 201, json: answerFor({ id: "11111111-1111-4111-8111-111111111111", title, updatedAt: "2026-10-18T05:00:00Z" }, changed) });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (String(args[0]).endsWith("/messages")) (window as unknown as { replyAt: number }).replyAt = performance.now();
      return res;
    };
  });
  const box = page.getByRole("textbox", { name: "ข้อความ" });
  const durations: number[] = [];
  for (let run = 0; run <= RUNS; run += 1) {
    price = 1000 + run; // above every other line price, so the text is new on the bill; run 0 only brings it up, runs 1..20 are measured
    await page.evaluate((text) => {
      const region = document.querySelector('[aria-label="ตัวอย่างบิล"]')!;
      (window as unknown as { shownAt: Promise<number> }).shownAt = new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          if (!region.querySelector("article")?.textContent?.includes(text)) return;
          observer.disconnect();
          resolve(performance.now());
        });
        observer.observe(region, { subtree: true, childList: true, characterData: true });
      });
    }, price.toLocaleString("en-US", { minimumFractionDigits: 2 }));
    await box.fill(`แก้ราคา ${run}`);
    await page.getByRole("button", { name: "ส่ง", exact: true }).click();
    const [shownAt, replyAt] = await page.evaluate(async () => [await (window as unknown as { shownAt: Promise<number> }).shownAt, (window as unknown as { replyAt: number }).replyAt]);
    if (run > 0) durations.push(shownAt - replyAt);
    await expect(box).toBeEnabled();
  }
  return durations;
}

test("[TC-DOC-034] changing the price of line 1 on a 2-line draft updates the bill within 1 second, 20 times", async ({ page }) => {
  const durations = await measureRuns(page, [line("กาแฟเย็น", 3, 55), line("ครัวซองต์", 2, 65)], "แก้ราคา");

  expect(durations).toHaveLength(RUNS);
  expect(Math.max(...durations)).toBeLessThanOrEqual(LIMIT_MS);
});

test("[TC-DOC-035] changing the price of line 1 on a 200-line draft updates the bill within 1 second, 20 times", async ({ page }) => {
  const items = Array.from({ length: 200 }, (_, i) => line(`สินค้า ${i + 1}`, 1, 10 + i));

  const durations = await measureRuns(page, items, "แก้ราคา 200");

  expect(durations).toHaveLength(RUNS);
  expect(Math.max(...durations)).toBeLessThanOrEqual(LIMIT_MS);
});
