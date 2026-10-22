import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: { data: undefined as unknown, isLoading: false, error: null as Error | null } }));
vi.mock("@/hooks/use-leave-management", () => ({ useLeaveRequest: () => mocks.request }));

import { LeaveDetailsModal } from "./leave-details-modal";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const approved = {
  id: REQUEST_ID, employee_id: "e1", leave_type_id: "t1", leave_type_name: "Mandatory Leave", starts_on: "2026-10-05", ends_on: "2026-10-06",
  status: "approved", created_at: "2026-10-05T01:00:00Z", reason: null, decision_note: null, excess_days: 0,
  employees: { first_name: "Tyson", middle_name: null, last_name: "Peters", employee_number: "4-15889" },
};

describe("LeaveDetailsModal", () => {
  beforeEach(() => { mocks.request = { data: approved, isLoading: false, error: null }; });

  it("shows the badge number, the inclusive dates with a day count and plain remarks", () => {
    render(<LeaveDetailsModal onClose={vi.fn()} requestId={REQUEST_ID} />);
    expect(screen.getByRole("dialog", { name: "Leave Application Details" })).toBeInTheDocument();
    expect(screen.queryByText("Historical record and processing remarks")).not.toBeInTheDocument();
    expect(screen.getByText("Badge Number:")).toBeInTheDocument();
    expect(screen.queryByText("Badge ID:")).not.toBeInTheDocument();
    expect(screen.getByText("4-15889")).toBeInTheDocument();
    expect(screen.getByText(/October 5, 2026 – October 6, 2026/)).toBeInTheDocument();
    expect(screen.getByText("2 days")).toBeInTheDocument();
    expect(screen.getByText("Remarks:")).toBeInTheDocument();
    expect(screen.getByText("No remarks provided.")).toBeInTheDocument();
    expect(screen.queryByText(/HR Processing Notes/)).not.toBeInTheDocument();
    expect(screen.queryByText("Days Deducted:")).not.toBeInTheDocument();
    expect(screen.getByText("Close", { selector: "button" })).toBeInTheDocument();
    expect(screen.queryByText("Close Window")).not.toBeInTheDocument();
  });

  it("shows HR's remarks and the days deducted beyond the leave credits", () => {
    mocks.request = { data: { ...approved, starts_on: "2026-10-05", ends_on: "2026-10-05", decision_note: "Approved.", excess_days: 1 }, isLoading: false, error: null };
    render(<LeaveDetailsModal onClose={vi.fn()} requestId={REQUEST_ID} />);
    expect(screen.getByText("Approved.")).toBeInTheDocument();
    expect(screen.getByText("Days Deducted:")).toBeInTheDocument();
    expect(screen.getAllByText("1 day")).toHaveLength(2);
  });
});
