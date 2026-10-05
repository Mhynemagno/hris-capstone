import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaveStatusBadge } from "./leave-status-badge";
import { allotmentLabel, LeaveTypeSummary } from "./leave-type-manager";

describe("leave presentation", () => {
  it("gives a rejected request an accessible textual status", () => {
    render(<LeaveStatusBadge status="rejected" />);
    expect(screen.getByText("Rejected")).toBeVisible();
  });

  it("shows a request awaiting HR as For Approval", () => {
    render(<LeaveStatusBadge status="pending" />);
    expect(screen.getByText("For Approval")).toBeVisible();
  });

  it("describes a type's yearly allotment", () => {
    expect(allotmentLabel({ days_per_year: null, excess_deducted_from_retirement: false })).toBe("No yearly limit");
    expect(allotmentLabel({ days_per_year: 2, excess_deducted_from_retirement: false })).toBe("2 days a year");
    expect(allotmentLabel({ days_per_year: 7, excess_deducted_from_retirement: true })).toBe("7 days a year · extra days deducted from retirement benefits");
  });

  it("shows a leave type by name without an evidence label", () => {
    render(<LeaveTypeSummary name="Sick leave" />);
    expect(screen.getByText("Sick leave")).toBeVisible();
    expect(screen.queryByText("Evidence required")).not.toBeInTheDocument();
  });
});
