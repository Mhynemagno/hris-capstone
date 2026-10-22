import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaveRequestTable } from "./leave-request-table";
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

  it("lists requests by Rank, Name, Leave Type, Status and Actions", () => {
    const row = { id: "r1", employee_id: "e1", submitted_by_user_id: null, leave_type_id: "t1", leave_type_name: "Sick Leave", starts_on: "2026-10-05", ends_on: "2026-10-06", reason: null, status: "pending" as const, excess_days: 0, decision_note: null, decided_by_user_id: null, decided_at: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", employees: { first_name: "Tyson", middle_name: null, last_name: "Peters", employee_number: "4-15889", ranks: { code: "PSSG" } } };
    render(<LeaveRequestTable emptyMessage="None" rows={[row]} />);
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Rank", "Name", "Leave Type", "Status", "Actions"]);
    expect(screen.getByText("PSSG")).toBeVisible();
    expect(screen.getByRole("link", { name: /^Review Tyson Peters's Sick Leave request/ })).toHaveAttribute("href", "/hr/leave-requests?review=r1");
  });
});
