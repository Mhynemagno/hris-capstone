import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  cancel: vi.fn(),
}));

vi.mock("@/hooks/use-leave-management", () => ({
  useMyLeaveRequests: () => ({ isLoading: false, error: null, data: { rows: mocks.rows } }),
  useCancelLeaveRequest: () => ({ isPending: false, mutateAsync: mocks.cancel }),
  useActiveLeaveTypes: () => ({ isLoading: false, error: null, data: [] }),
  useSubmitLeaveRequest: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { EmployeeLeaveList } from "./employee-leave";

describe("EmployeeLeaveList", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.cancel.mockReset();
  });

  it("shows a useful empty state when there are no leave requests", () => {
    render(<EmployeeLeaveList />);
    expect(screen.getByText("No leave requests yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Request leave" })).toHaveAttribute("href", "/employee/leave/new");
  });

  it("reports a failed cancellation without removing the request", async () => {
    mocks.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000", leave_type_name: "Annual leave", starts_on: "2026-09-01", ends_on: "2026-09-02", reason: "Family event", status: "pending", decision_note: null }];
    mocks.cancel.mockRejectedValue(new Error("Cancellation failed"));
    const user = userEvent.setup();
    render(<EmployeeLeaveList />);

    await user.click(screen.getByRole("button", { name: "Cancel request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cancellation failed");
    expect(screen.getByText(/Annual leave/)).toBeVisible();
  });
});
