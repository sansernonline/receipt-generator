import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import HomePage from "@/app/page";

test("[placeholder-unit] home page shows the app name", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "Bill Gen" })).toBeInTheDocument();
});
