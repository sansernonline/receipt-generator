import { expect, test } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { draftWith } from "@/features/draft/test-kit";
import { cashShop } from "@/features/shop-header/test-kit";
import { parseBill } from "./fetch-bill";

const good = () => {
  const draft = draftWith();
  return { draft, totals: totalsOf(draft) };
};

test("[TC-DOC-001] an answer with a draft and matching totals is read", () => {
  expect(parseBill(good())).toMatchObject({ draft: { items: [{ name: "กาแฟเย็น" }, { name: "ครัวซองต์" }] } });
});

test("[review] totals with a different number of lines than the draft are damaged data, not a bill", () => {
  const { draft, totals } = good();

  expect(parseBill({ draft, totals: { ...totals, lines: totals.lines.slice(1) } })).toBeNull();
});

test.each([["no bill info", (draft: object) => ({ ...draft, bill: undefined })], ["a bill info that is null", (draft: object) => ({ ...draft, bill: null })]])("[review] a draft with %s is damaged data", (_name, damage) => {
  const { draft, totals } = good();

  expect(parseBill({ draft: damage(draft), totals })).toBeNull();
});

test.each([[null], [undefined], ["x"], [{}], [{ draft: { items: [] }, totals: { lines: [] } }]])("[review] %j is not a bill", (raw) => {
  expect(parseBill(raw)).toBeNull();
});

test("[TC-HDR-022] the shop header of the answer is kept", () => {
  expect(parseBill({ ...good(), shop: { id: "s1", ...cashShop } })?.shop).toMatchObject({ shopName: "ร้านกาแฟบ้านสวน", template: "cash" });
});

test.each([[undefined], [null], [{ id: "s1", shopName: 123 }], ["ร้าน"]])("[review] a shop header of %j is read as no shop", (shop) => {
  expect(parseBill({ ...good(), shop })?.shop).toBeNull();
});
