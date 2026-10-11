import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams(), updateType: vi.fn(), setAllotment: vi.fn(), notify: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/leave-requests", useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("./leave-review-modal", () => ({ LeaveReviewModal: ({ requestId }: { requestId: string }) => <div role="dialog">Review {requestId}</div> }));
vi.mock("./leave-details-modal", () => ({ LeaveDetailsModal: ({ requestId }: { requestId: string }) => <div role="dialog">Details {requestId}</div> }));

const type = (id: string, name: string, days: number | null) => ({ id, name, description: null, requires_attachment: false, is_active: true, days_per_year: days, excess_deducted_from_retirement: false, eligible_gender: null });
const request = (id: string, status: string) => ({ id, employee_id: "e1", leave_type_id: "t1", leave_type_name: "Mandatory Leave", starts_on: "2026-10-05", ends_on: "2026-10-06", status, created_at: "2026-10-05T01:00:00Z", employees: { first_name: "Tyson", middle_name: null, last_name: "Peters", employee_number: "4-15889" } });

vi.mock("@/hooks/use-leave-management", () => ({
  useLeaveTypes: () => ({ isLoading: false, error: null, data: { rows: [type("00000000-0000-4000-8000-000000000001", "Mandatory Leave", 2), type("00000000-0000-4000-8000-000000000002", "Maternity Leave", 105), type("00000000-0000-4000-8000-000000000003", "Paternity Leave", 7), type("00000000-0000-4000-8000-000000000004", "Sick Leave", 15), type("00000000-0000-4000-8000-000000000005", "Special Privilege Leave", null)], count: 5 } }),
  useHrLeaveRequests: () => ({ isLoading: false, error: null, data: { rows: [request("r1", "pending"), request("r2", "approved")], count: 2 } }),
  useUpdateLeaveType: () => ({ mutateAsync: mocks.updateType, isPending: false }),
  useSetLeaveTypeAllotment: () => ({ mutateAsync: mocks.setAllotment, isPending: false }),
}));

import { StaffLeave } from "./staff-leave";

describe("StaffLeave (leave.html)", () => {
  beforeEach(() => { mocks.params = new URLSearchParams(); });
  afterEach(() => { mocks.replace.mockReset(); mocks.updateType.mockReset(); mocks.setAllotment.mockReset(); mocks.notify.mockReset(); });

  it("shows the entitlement cards", () => {
    render(<StaffLeave />);
    expect(screen.getByRole("heading", { level: 1, name: "Leave Management" })).toBeInTheDocument();
    expect(screen.getByText("Annual Leave Entitlements")).toBeInTheDocument();
    expect(screen.getByText("5 Active Categories")).toBeInTheDocument();
    const maternity = screen.getByText("Maternity Leave").closest("article")!;
    expect(maternity).toHaveTextContent("105 Days");
    expect(maternity).toHaveTextContent("/ Year");
    expect(maternity).toHaveTextContent("Full pay for female personnel.");
    expect(screen.getByText("Special Privilege Leave").closest("article")).toHaveTextContent("No limit");
  });

  it("updates a policy from its card", async () => {
    mocks.updateType.mockResolvedValue(undefined);
    mocks.setAllotment.mockResolvedValue(undefined);
    render(<StaffLeave />);
    await userEvent.click(screen.getByRole("button", { name: "Update Policy: Maternity Leave" }));
    const dialog = await screen.findByRole("dialog", { name: "Update Policy: Maternity Leave" });
    const days = within(dialog).getByLabelText(/Allowed Days Per Year/);
    expect(days).toHaveValue(105);
    await userEvent.clear(days);
    await userEvent.type(days, "120");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.setAllotment).toHaveBeenCalledWith({ id: "00000000-0000-4000-8000-000000000002", daysPerYear: 120, excessDeductedFromRetirement: false }));
    expect(mocks.updateType).toHaveBeenCalledWith(expect.objectContaining({ id: "00000000-0000-4000-8000-000000000002", name: "Maternity Leave" }));
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Leave policy updated" });
  });

  it("lists the queue with Review for pending rows and View for others", async () => {
    render(<StaffLeave />);
    expect(screen.getByRole("searchbox", { name: "Search leave requests" })).toHaveAttribute("placeholder", "Search this page's employee or badge no...");
    const [, pendingRow, approvedRow] = screen.getAllByRole("row");
    expect(within(pendingRow!).getByText("For Approval")).toBeInTheDocument();
    expect(within(approvedRow!).queryByRole("button", { name: /^Review/ })).not.toBeInTheDocument();
    await userEvent.click(within(pendingRow!).getByRole("button", { name: "Review Tyson Peters's Mandatory Leave request, October 5, 2026 to October 6, 2026" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/leave-requests?review=r1", { scroll: false });
    await userEvent.click(within(approvedRow!).getByRole("button", { name: /^View Tyson Peters/ }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/hr/leave-requests?view=r2", { scroll: false });
    expect(within(screen.getByRole("combobox", { name: "Leave status" })).getByRole("option", { name: "Cancelled" })).toBeInTheDocument();
  });

  it("opens the review from the URL", () => {
    mocks.params = new URLSearchParams("review=r1");
    render(<StaffLeave />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Review r1");
  });
});
