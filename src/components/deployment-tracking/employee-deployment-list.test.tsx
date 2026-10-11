import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmployeeDeploymentList } from "./employee-deployment-list";

const base = { employee_id: "e1", unit: null, project: null, assignment_role: null, deployment_type: "Public Assembly", event_operation: "Rally", updated_at: "2026-09-23T00:00:00Z" };
const rows = [
  { ...base, id: "d1", location: "Greenhills Area Deployment", starts_on: "2026-09-28", ends_on: null, status: "ongoing", notes: "Report to Greenhills Sub-Station" },
  { ...base, id: "d2", location: "Manila Area Detail", starts_on: "2026-10-05", ends_on: null, status: "scheduled", notes: "CDM standby" },
  { ...base, id: "d3", location: "Completed detail", starts_on: "2026-08-01", ends_on: "2026-08-09", status: "completed", notes: null },
];
const state = { loading: false, error: null as Error | null };
const useMyDeployments = vi.fn((input: { page?: number; pageSize?: number; status?: string }) => {
  const data = input.status ? rows.filter((r) => r.status === input.status) : rows;
  return { isLoading: state.loading, error: state.error, data: state.loading || state.error ? undefined : { rows: data, count: data.length } };
});
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useMyDeployments: (input: { page?: number; pageSize?: number; status?: string }) => useMyDeployments(input),
  useDeploymentReports: () => ({ isLoading: false, error: null, data: [] }),
  useSubmitDeploymentReport: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

describe("EmployeeDeploymentList", () => {
  beforeEach(() => { state.loading = false; state.error = null; useMyDeployments.mockClear(); });

  it("renders the module heading, cards with status text, word-form dates and remarks", () => {
    render(<EmployeeDeploymentList />);
    expect(screen.getByText("Personnel Assignment Module")).toBeVisible();
    expect(screen.getByRole("heading", { name: "My Deployments" })).toBeVisible();
    expect(screen.getByText("September 28, 2026 – Present")).toBeVisible();
    expect(screen.getByText("October 5, 2026 – Open Ended")).toBeVisible();
    expect(screen.getByText("August 1, 2026 – August 9, 2026")).toBeVisible();
    expect(screen.getAllByText("Ongoing")).toHaveLength(2); // filter option + card pill
    expect(screen.getAllByText("Scheduled")).toHaveLength(2);
    expect(screen.getByText(/CDM standby/)).toBeVisible();
    expect(screen.getByText("Showing 1–3 of 3 deployments")).toBeVisible();
  });

  it("filters by status on the server and keeps the report action", async () => {
    const user = userEvent.setup();
    render(<EmployeeDeploymentList />);
    await user.selectOptions(screen.getByLabelText("Filter Status"), "ongoing");
    expect(useMyDeployments).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, status: "ongoing" });
    expect(screen.getByText("Greenhills Area Deployment")).toBeVisible();
    expect(screen.queryByText("Completed detail")).not.toBeInTheDocument();
    const report = screen.getByRole("button", { name: "Report / Proof of Attendance" });
    expect(report).toBeVisible();
    await user.click(report);
    expect(screen.getByRole("button", { name: "Submit report" })).toBeVisible();
  });

  it("shows a direct empty state for a status with no deployments", async () => {
    const user = userEvent.setup();
    render(<EmployeeDeploymentList />);
    await user.selectOptions(screen.getByLabelText("Filter Status"), "cancelled");
    expect(screen.getByText("No cancelled deployments found.")).toBeVisible();
  });

  it("does not claim emptiness or a 0 of 0 pager while loading or on error", () => {
    state.loading = true;
    const { rerender } = render(<EmployeeDeploymentList />);
    expect(screen.queryByText(/No .*deployments/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument();
    state.loading = false; state.error = new Error("boom");
    rerender(<EmployeeDeploymentList />);
    expect(screen.getByText("boom")).toBeVisible();
    expect(screen.queryByText(/No .*deployments/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 of 0/)).not.toBeInTheDocument();
  });

  it("offers no create or edit controls", () => {
    render(<EmployeeDeploymentList />);
    expect(screen.queryByRole("button", { name: /create|new|edit|add/i })).not.toBeInTheDocument();
  });
});
