import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaveStatusBadge } from "./leave-status-badge";
import { LeaveTypeSummary } from "./leave-type-manager";

describe("leave presentation", () => {
  it("gives a rejected request an accessible textual status", () => {
    render(<LeaveStatusBadge status="rejected" />);
    expect(screen.getByText("rejected")).toBeVisible();
  });

  it("shows a leave type by name without an evidence label", () => {
    render(<LeaveTypeSummary name="Sick leave" />);
    expect(screen.getByText("Sick leave")).toBeVisible();
    expect(screen.queryByText("Evidence required")).not.toBeInTheDocument();
  });
});
