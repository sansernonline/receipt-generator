import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { draftWith } from "@/features/draft/test-kit";
import { cashShop } from "@/features/shop-header/test-kit";
import type { ShopHeader } from "@/features/shop-header/types";
import { BillPreview } from "./bill-preview";

afterEach(cleanup);

const render_ = (shop: Partial<ShopHeader>) => render(<BillPreview bill={{ draft: draftWith(), totals: totalsOf(draftWith()), shop: { id: "s1", ...cashShop, template: "receipt", ...shop } }} />);
const article = () => screen.getByRole("article");

test("[TC-HDR-016] the accent from the sample picture is the colour of the bill's accents", () => {
  render_({ accent: "#1f4e9c" });

  expect(article().style.getPropertyValue("--color-accent")).toBe("#1f4e9c");
});

test("[TC-HDR-017] no accent: the bill keeps the template's own colour", () => {
  render_({});

  expect(article().style.getPropertyValue("--color-accent")).toBe("");
});

