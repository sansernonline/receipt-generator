import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { totalsOf } from "@/features/draft/draft-totals";
import { draftWith } from "@/features/draft/test-kit";
import { cashShop } from "@/features/shop-header/test-kit";
import type { ShopHeader } from "@/features/shop-header/types";
import { BillPreview } from "./bill-preview";

afterEach(cleanup);

const LOGO = "data:image/png;base64,iVBORw0KGgo=";
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

test("[FR-HDR-170] a shop with a logo shows it in the head, beside the shop name", () => {
  render_({ logo: LOGO });

  expect(within(article()).getByRole("img", { name: "โลโก้ร้าน" })).toHaveAttribute("src", LOGO);
});

test("[TC-HDR-049] a shop with no logo shows no picture in the head", () => {
  render_({});

  expect(within(article()).queryByRole("img")).toBeNull();
});
