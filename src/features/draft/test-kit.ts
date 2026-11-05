import { emptyDraft } from "./parse-draft";
import type { Draft, DraftItem } from "./types";

export const coffee: DraftItem = { code: null, name: "กาแฟเย็น", description: null, qty: 3, unit: "แก้ว", unitPrice: 55, discount: null };
export const croissant: DraftItem = { code: null, name: "ครัวซองต์", description: null, qty: 2, unit: "ชิ้น", unitPrice: 65, discount: null };

export const draftWith = (items: DraftItem[] = [coffee, croissant]): Draft => ({ ...emptyDraft(), items });
export const addWater = { op: "add_item", name: "น้ำเปล่า", qty: 1, unit: "ขวด", unit_price: 10, code: null, description: null };
