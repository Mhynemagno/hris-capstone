import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ decide: vi.fn(), notify: vi.fn(), request: { data: undefined as unknown, isLoading: false, error: null as Error | null } }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/hooks/use-leave-management", () => ({
  useLeaveRequest: () => mocks.request,
  useEmployeeLeaveBalances: () => ({ data: [{ leave_type_id: "t1", days_per_year: 2, excess_deducted_from_retirement: false, used_days: 1 }] }),
  useDecideLeaveRequest: () => ({ mutateAsync: mocks.decide, isPending: false }),
}));
vi.mock("@/queries/leave-management", () => ({ getLeaveAttachmentUrl: vi.fn() }));

import { LeaveReviewModal } from "./leave-review-modal";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const pending = {
  id: REQUEST_ID, employee_id: "e1", leave_type_id: "t1", leave_type_name: "Mandatory Leave", starts_on: "2026-10-05", ends_on: "2026-10-06",
  status: "pending", created_at: "2026-10-05T01:00:00Z", reason: null, decision_note: null, excess_days: 0,
  employees: { first_name: "Tyson", middle_name: "Bernal", last_name: "Peters", employee_number: "4-15889" },
  leave_request_attachments: [{ id: "a1", object_path: "leave/x.pdf", file_name: "medcert.pdf" }],
};

describe("LeaveReviewModal (leave.html Review)", () => {
  beforeEach(() => { mocks.request = { data: pending, isLoading: false, error: null }; });
  afterEach(() => { mocks.decide.mockReset(); mocks.notify.mockReset(); });

  it("requires HR remarks before approving or declining", async () => {
    const onClose = vi.fn();
    mocks.decide.mockResolvedValue(undefined);
    render(<LeaveReviewModal onClose={onClose} requestId={REQUEST_ID} />);
    expect(screen.getByRole("dialog", { name: "Review Leave Request" })).toBeInTheDocument();
    expect(screen.getByText("Tyson Bernal Peters")).toBeInTheDocument();
    expect(screen.getByText("Badge: 4-15889")).toBeInTheDocument();
    expect(screen.getByText("Balance: 1 of 2 days")).toBeInTheDocument();
    expect(screen.getByText("2 days", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText(/Days deducted/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attachment: medcert.pdf" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve Request" }));
    expect(screen.getByText("HR Remarks are required to proceed.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Decline Request" }));
    expect(mocks.decide).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/HR Remarks \/ Notes/), "Endorsed by Station Admin.");
    await userEvent.click(screen.getByRole("button", { name: "Approve Request" }));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledTimes(1));
    expect(mocks.decide).toHaveBeenCalledWith({ requestId: REQUEST_ID, decision: "approved", note: "Endorsed by Station Admin." });
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Leave request approved" });
    expect(onClose).toHaveBeenCalled();
  });

  it("declines with remarks", async () => {
    mocks.decide.mockResolvedValue(undefined);
    render(<LeaveReviewModal onClose={vi.fn()} requestId={REQUEST_ID} />);
    await userEvent.type(screen.getByLabelText(/HR Remarks \/ Notes/), "Overlapping duty.");
    await userEvent.click(screen.getByRole("button", { name: "Decline Request" }));
    await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith({ requestId: REQUEST_ID, decision: "rejected", note: "Overlapping duty." }));
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Leave request declined" });
  });

  it("says when the request was already decided", () => {
    mocks.request = { data: { ...pending, status: "approved" }, isLoading: false, error: null };
    render(<LeaveReviewModal onClose={vi.fn()} requestId={REQUEST_ID} />);
    expect(screen.getByText("This leave request was already decided.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve Request" })).not.toBeInTheDocument();
    expect(screen.getByText("Close", { selector: "button" })).toBeInTheDocument();
    expect(screen.queryByText("Close Window")).not.toBeInTheDocument();
  });

  it("shows the days deducted when the request goes beyond the leave credits", () => {
    mocks.request = { data: { ...pending, excess_days: 1 }, isLoading: false, error: null };
    render(<LeaveReviewModal onClose={vi.fn()} requestId={REQUEST_ID} />);
    expect(screen.getByText("Days deducted: 1 day beyond the employee's leave credits")).toBeInTheDocument();
  });

  it("says when the request cannot be found", () => {
    mocks.request = { data: null, isLoading: false, error: null };
    render(<LeaveReviewModal onClose={vi.fn()} requestId={REQUEST_ID} />);
    expect(screen.getByText("This leave request could not be found.")).toBeInTheDocument();
  });
});
