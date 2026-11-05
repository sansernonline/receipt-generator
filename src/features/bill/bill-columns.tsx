import type { ReactNode } from "react";
import type { DraftItem } from "@/features/draft/types";
import { formatMoney } from "./bill-format";
import type { TemplateId } from "./bill-templates";
import { Missing } from "./missing";

export type Row = { item: DraftItem; index: number; amount: number };
// minWidth: only the text columns may wrap, and they keep this much room on a narrow sheet; every other cell stays on one line
export type Column = { header: string; align: "left" | "center" | "right"; cell: (row: Row) => ReactNode; isDiscount?: boolean; minWidth?: string };

const isIncomplete = ({ item }: Row) => item.qty === null || item.unitPrice === null;
const number = (header: string): Column => ({ header, align: "center", cell: ({ index }) => index + 1 });
const code: Column = { header: "รหัสสินค้า", align: "left", cell: ({ item }) => item.code };
const name = (header: string): Column => ({ header, align: "left", minWidth: "min-w-28", cell: ({ item }) => item.name });
const description: Column = { header: "รายละเอียด", align: "left", minWidth: "min-w-24", cell: ({ item }) => item.description };
const quantity = (header: string): Column => ({
  header,
  align: "center",
  cell: ({ item }) => (item.qty === null ? <Missing>ไม่มี</Missing> : `${item.qty}${item.unit ? ` ${item.unit}` : ""}`),
});
const price = (header: string): Column => ({
  header,
  align: "right",
  cell: ({ item }) => (item.unitPrice === null ? <Missing>ไม่มีราคา</Missing> : formatMoney(item.unitPrice)),
});
const discount: Column = {
  header: "ส่วนลด",
  align: "right",
  isDiscount: true,
  cell: ({ item }) => (item.discount ? (item.discount.kind === "percent" ? `${item.discount.value}%` : formatMoney(item.discount.value)) : ""),
};
const amount = (header: string): Column => ({ header, align: "right", cell: (row) => (isIncomplete(row) ? "—" : formatMoney(row.amount)) });

// column order and header words follow the mockup headFor(); the receipt also shows the product code (TC-DOC-002)
export const COLUMNS: Record<TemplateId, Column[]> = {
  cash: [quantity("จำนวน"), name("รายการ"), price("หน่วยละ"), amount("จำนวนเงิน")],
  receipt: [number("#"), code, name("รายการ"), quantity("จำนวน"), price("ราคา/หน่วย"), discount, amount("จำนวนเงิน")],
  taxinv: [number("#"), name("รายการ"), quantity("จำนวน"), price("ราคา/หน่วย"), discount, amount("จำนวนเงิน")],
  invoice: [number("ลำดับ"), name("สินค้า"), description, quantity("จำนวน"), price("ราคา/หน่วย"), discount, amount("ราคารวม")],
};
