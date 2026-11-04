import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "@/app/page";

test("home page shows new-chat button, message box and bill preview area", () => {
  render(<HomePage />);

  expect(screen.getByRole("button", { name: "แชตใหม่" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "ข้อความ" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "ตัวอย่างบิล" })).toBeInTheDocument();
});
