import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { Pagination } from "./pagination";

it("announces the displayed range and disables final-page navigation", () => {
  render(<Pagination from={21} noun="employees" onPageChange={vi.fn()} page={2} pageCount={2} to={23} total={23} />);

  expect(screen.getByText("21–23 of 23 employees")).toBeVisible();
  expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
});
