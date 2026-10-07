import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ value: { data: 3 as number | undefined, isError: false } }));
vi.mock("@/hooks/use-workspace-counts", () => ({ useWorkspaceCount: () => state.value }));

import { NavBadge } from "./nav-badge";

it("shows the count with a screen-reader phrase", () => {
  state.value = { data: 3, isError: false };
  render(<NavBadge badge="leaveForApproval" />);
  expect(screen.getByText("3 waiting")).toHaveClass("sr-only");
});

it("hides the badge on error and at zero", () => {
  state.value = { data: undefined, isError: true };
  const { container, rerender } = render(<NavBadge badge="leaveForApproval" />);
  expect(container).toBeEmptyDOMElement();
  state.value = { data: 0, isError: false };
  rerender(<NavBadge badge="leaveForApproval" />);
  expect(container).toBeEmptyDOMElement();
});
