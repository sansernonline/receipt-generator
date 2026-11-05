import fsp from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const dataDir = path.resolve("test-results", "e2e-data");
const shot = (name: string) => path.resolve("..", "_to_delete", "row25-26", `${name}.png`);
const shop = { shopName: "ร้านกาแฟบ้านสวน", address: "12/3 ถ.สุขุมวิท ชลบุรี", taxId: "", phone: "038-123456", email: "", template: "cash" };
const line = (name: string, qty: number, unitPrice: number) => ({ code: null, name, description: null, qty, unit: "ชิ้น", unitPrice, discount: null });
const emptyBill = { customerName: null, customerAddress: null, customerTaxId: null, customerPhone: null, customerEmail: null, billNumber: null, billDate: null, ref: null, dueDate: null, quoteRef: null, quotedBy: null };
const footer = { vat: { mode: "none", rate: 7 }, discount: null, paymentMethod: null, paymentDate: null, paymentDetail: null, remarks: null };
const draftOf = (items: object[]) => ({ items, bill: emptyBill, footer });

test("[TC-ITEM-032] [TC-ITEM-035] ย้อนกลับ takes the last edit off the bill and is off when there is nothing left to take back", async ({ page, request, baseURL }, testInfo) => {
  const headers = { origin: baseURL! };
  const title = `ย้อนกลับ ${testInfo.project.name}`;
  const { chat } = await (await request.post("/api/chats", { headers })).json();
  await request.patch(`/api/chats/${chat.id}`, { headers, data: { title } });
  await request.post(`/api/chats/${chat.id}/shop`, { headers, data: shop });
  const dir = path.join(dataDir, "chats", chat.id);
  await fsp.writeFile(path.join(dir, "draft.json"), JSON.stringify(draftOf([line("กาแฟเย็น", 3, 55), line("ครัวซองต์", 2, 65)])));
  await fsp.writeFile(path.join(dir, "undo.json"), JSON.stringify([draftOf([line("กาแฟเย็น", 3, 55)])]));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "รายการแชต" }).getByRole("button", { name: title }).click();
  const bill = page.getByRole("region", { name: "ตัวอย่างบิล" });
  const undo = bill.getByRole("button", { name: "ย้อนกลับ" });
  await expect(bill.getByText("ครัวซองต์")).toBeVisible();
  await page.screenshot({ path: shot(`undo-before-${testInfo.project.name}`) });

  await undo.click();

  await expect(bill.getByText("ครัวซองต์")).toHaveCount(0);
  await expect(bill.getByText("กาแฟเย็น")).toBeVisible();
  await expect(undo).toBeDisabled();
  await page.screenshot({ path: shot(`undo-after-${testInfo.project.name}`) });
});
