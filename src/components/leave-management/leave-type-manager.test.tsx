import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const sickLeave = {
  id: "33333333-3333-4333-8333-333333333333", name: "Sick Leave", description: null, requires_attachment: false, is_active: true,
  days_per_year: 15, excess_deducted_from_retirement: false, eligible_gender: null, created_by_user_id: null, updated_by_user_id: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/hooks/use-leave-management", () => ({
  useLeaveTypes: () => ({ isLoading: false, error: null, data: { rows: [sickLeave], count: 1 } }),
  useCreateLeaveType: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateLeaveType: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSetLeaveTypeAllotment: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/use-deletion", () => ({
  useDeletionImpact: () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useDeleteRecord: () => ({ isPending: false, mutateAsync: vi.fn(), reset: vi.fn(), error: null }),
}));

import { LeaveTypeManager } from "./leave-type-manager";

describe("LeaveTypeManager", () => {
  it("only lets HR update the existing leave types", async () => {
    const user = userEvent.setup();
    render(<LeaveTypeManager />);
    expect(screen.queryByRole("button", { name: "Add leave type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Deactivate|^Activate|^Delete/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update Sick Leave" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
  });
});
