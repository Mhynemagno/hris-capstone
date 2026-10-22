import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), notify: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/deployments", useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("./deployment-panel", () => ({ DeploymentPanel: ({ mode }: { mode: { kind: string } | null }) => (mode ? <div role="dialog">{mode.kind === "create" ? "Create Deployment" : "Edit Deployment"}</div> : null) }));

const base = { employee_id: "e1", location: "San Juan", unit: null, unit_station_id: null, project: null, assignment_role: "Reserve/Standby", task: "Reserve/Standby", notes: null, deployment_type: "Public Assembly", event_operation: "Rally", deployment_group_id: null, proposed_status: null, proposed_at: null, status_reviewed_at: null, status_reviewed_by_user_id: null, created_by_user_id: null, updated_by_user_id: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", employee: { id: "e1", employee_number: "0-11152", first_name: "Danilo", middle_name: "Fernandez", last_name: "Aguilar", qualifier: "Jr", rank: { code: "PCPL" } } };
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useHrDeployments: () => ({
    isLoading: false,
    error: null,
    data: { count: 2, rows: [
      { ...base, id: "d1", starts_on: "2026-10-13", ends_on: "2026-10-13", status: "ongoing", proposed_status: "completed" },
      { ...base, id: "d2", starts_on: "2026-09-25", ends_on: null, status: "cancelled" },
    ] },
  }),
  useCancelDeployment: () => ({ mutateAsync: mocks.cancel, isPending: false }),
}));

import { StaffDeployments } from "./staff-deployments";

describe("StaffDeployments (dep.html)", () => {
  beforeEach(() => { mocks.params = new URLSearchParams(); vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { vi.restoreAllMocks(); mocks.cancel.mockReset(); mocks.notify.mockReset(); mocks.replace.mockReset(); });

  it("lists rank, name, badge number, task, location and status, with proposals flagged for approval", () => {
    render(<StaffDeployments />);
    expect(screen.getByRole("heading", { level: 1, name: "DEPLOYMENTS" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search deployments" })).toHaveAttribute("placeholder", "Search employee name, badge number or location...");
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Rank", "Name", "Badge Number", "Task", "Location", "Status", "Actions"]);
    const row = screen.getAllByText("Danilo Fernandez Aguilar Jr")[0]!.closest("tr")!;
    expect(within(row).getByText("PCPL")).toBeInTheDocument();
    expect(within(row).getByText("0-11152")).toBeInTheDocument();
    expect(within(row).getByText("Reserve/Standby")).toBeInTheDocument();
    expect(within(row).getByText("Ongoing")).toBeInTheDocument();
    expect(within(row).getByText("Update for approval")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "View Details" })).toHaveAttribute("href", "/hr/deployments/d1");
    expect(screen.queryByRole("region", { name: "Grouped deployment assignments" })).not.toBeInTheDocument();
    expect(screen.queryByText(/October 13, 2026/)).not.toBeInTheDocument();
  });

  it("opens the side panel from New Deployment instead of a new page", async () => {
    render(<StaffDeployments />);
    await userEvent.click(screen.getByRole("button", { name: /New Deployment/ }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/deployments?create=1", { scroll: false });
  });

  it("renders the panel from the URL", () => {
    mocks.params = new URLSearchParams("create=1");
    render(<StaffDeployments />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Create Deployment");
  });

  it("cancels a deployment (the only HR status action) and hides the action on cancelled rows", async () => {
    mocks.cancel.mockResolvedValue(undefined);
    render(<StaffDeployments />);
    const [ongoing, cancelled] = screen.getAllByRole("row").slice(1);
    expect(within(cancelled!).queryByRole("button", { name: "Cancel Deployment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Deployment" })).not.toBeInTheDocument();
    await userEvent.click(within(ongoing!).getByRole("button", { name: "Cancel Deployment" }));
    expect(window.confirm).toHaveBeenCalledWith("Cancel this deployment?");
    expect(mocks.cancel).toHaveBeenCalledWith({ id: "d1", expectedUpdatedAt: "2026-10-01T00:00:00Z" });
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Deployment cancelled" });
  });

  it("filters by the tester's deployment types", () => {
    render(<StaffDeployments />);
    const type = screen.getByRole("combobox", { name: "Deployment type" });
    expect(within(type).getAllByRole("option").map((option) => option.textContent)).toEqual(["Deployment Types", "Public Assembly", "Special Event", "Election Security", "Disaster Response"]);
  });
});
