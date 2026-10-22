import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ review: vi.fn(), cancel: vi.fn(), notify: vi.fn(), deployment: {} as Record<string, unknown> }));

const base = {
  id: "00000000-0000-4000-8000-000000000901", employee_id: "e1", location: "Whiteplains, EDSA", unit: null, unit_station_id: null, project: null,
  assignment_role: "Deployed", task: "Deployed", starts_on: "2026-10-10", ends_on: null, status: "scheduled", notes: "Old remark",
  deployment_type: "Special Event", event_operation: "Fiesta / Major Event", deployment_group_id: null, proposed_status: null, proposed_at: null,
  status_reviewed_at: null, status_reviewed_by_user_id: null, created_by_user_id: null, updated_by_user_id: null,
  created_at: "2026-10-09T10:12:00Z", updated_at: "2026-10-09T10:12:00Z",
  employee: { id: "e1", employee_number: "1-60482", first_name: "Maria", middle_name: null, last_name: "Balneg", qualifier: null, rank: { code: "PSSG" } },
};

vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useDeployment: () => ({ data: mocks.deployment, isLoading: false, error: null }),
  useReviewDeploymentStatus: () => ({ mutateAsync: mocks.review, isPending: false }),
  useCancelDeployment: () => ({ mutateAsync: mocks.cancel, isPending: false }),
  useDeploymentReports: () => ({ data: [], isLoading: false, error: null }),
  useSubmitDeploymentReport: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { HrDeploymentDetails } from "./hr-deployment-details";

describe("HrDeploymentDetails", () => {
  beforeEach(() => { mocks.deployment = { ...base }; vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { vi.restoreAllMocks(); mocks.review.mockReset(); mocks.cancel.mockReset(); mocks.notify.mockReset(); });

  it("shows the assignment read-only with its task and dates, without remarks or history", () => {
    render(<HrDeploymentDetails deploymentId={base.id} />);
    expect(screen.getByText(/PSSG Maria Balneg/)).toBeVisible();
    expect(screen.getByText("Whiteplains, EDSA")).toBeVisible();
    expect(screen.getByText("Task")).toBeVisible();
    expect(screen.getByText("Deployed")).toBeVisible();
    expect(screen.getByText("October 10, 2026")).toBeVisible();
    expect(screen.queryByText("Remarks")).not.toBeInTheDocument();
    expect(screen.queryByText("Old remark")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reports / proof of attendance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update" })).toHaveAttribute("href", `/hr/deployments?edit=${base.id}`);
    expect(screen.queryByRole("heading", { name: "History" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("approves or rejects the status the employee proposed", async () => {
    mocks.deployment = { ...base, proposed_status: "completed", proposed_at: "2026-10-11T02:00:00Z" };
    mocks.review.mockResolvedValue(undefined);
    render(<HrDeploymentDetails deploymentId={base.id} />);
    expect(screen.getByRole("region", { name: "Status update for approval" })).toHaveTextContent("Completed");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(mocks.review).toHaveBeenLastCalledWith({ id: base.id, approve: true });
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(mocks.review).toHaveBeenLastCalledWith({ id: base.id, approve: false });
  });

  it("cancels after confirmation and offers no cancel once closed", async () => {
    mocks.cancel.mockResolvedValue(undefined);
    const { unmount } = render(<HrDeploymentDetails deploymentId={base.id} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deployment" }));
    expect(window.confirm).toHaveBeenCalledWith("Cancel this deployment?");
    expect(mocks.cancel).toHaveBeenCalledWith({ id: base.id, expectedUpdatedAt: base.updated_at });
    unmount();
    mocks.deployment = { ...base, status: "cancelled" };
    render(<HrDeploymentDetails deploymentId={base.id} />);
    expect(screen.queryByRole("button", { name: "Cancel deployment" })).not.toBeInTheDocument();
  });
});
