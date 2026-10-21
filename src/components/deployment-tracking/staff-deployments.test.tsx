import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), notify: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/deployments", useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("./deployment-panel", () => ({ DeploymentPanel: ({ mode }: { mode: { kind: string } | null }) => (mode ? <div role="dialog">{mode.kind === "create" ? "Create Deployment" : "Edit Deployment"}</div> : null) }));

const base = { employee_id: "e1", location: "San Juan", unit: null, unit_station_id: null, project: null, assignment_role: "San Juan", notes: "Crowd control", deployment_type: "Public Assembly", event_operation: "Rally", created_by_user_id: null, updated_by_user_id: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useHrDeployments: () => ({
    isLoading: false,
    error: null,
    data: { count: 2, rows: [
      { ...base, id: "d1", starts_on: "2026-10-13", ends_on: "2026-10-13", status: "ongoing" },
      { ...base, id: "d2", starts_on: "2026-09-25", ends_on: null, status: "cancelled" },
    ] },
  }),
  useHrDeploymentGroupAssignments: () => ({
    isLoading: false,
    error: null,
    data: [{ id: "ga1", employee_id: "e1", task: "Reserve/Standby", status: "scheduled", deployment_group: { id: "g1", location: "City Hall", starts_on: "2026-10-14", ends_on: null, deployment_type: "Public Assembly", event_operation: "Rally" }, employee: { id: "e1", fullName: "Danilo Fernandez Aguilar Jr", employeeNumber: "0-11152" } }],
  }),
  useEmployeeOptions: () => ({ data: [{ id: "e1", fullName: "Danilo Fernandez Aguilar Jr", employeeNumber: "0-11152" }] }),
  useUpdateDeployment: () => ({ mutateAsync: mocks.update, isPending: false }),
}));

import { StaffDeployments } from "./staff-deployments";

describe("StaffDeployments (dep.html)", () => {
  beforeEach(() => { mocks.params = new URLSearchParams(); vi.spyOn(window, "confirm").mockReturnValue(true); });
  afterEach(() => { vi.restoreAllMocks(); mocks.update.mockReset(); mocks.notify.mockReset(); mocks.replace.mockReset(); });

  it("lists deployments with the mockup columns", () => {
    render(<StaffDeployments />);
    expect(screen.getByRole("heading", { level: 1, name: "DEPLOYMENTS" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search deployments" })).toHaveAttribute("placeholder", "Search employee name, badge number or location...");
    const row = screen.getAllByText("Danilo Fernandez Aguilar Jr")[0]!.closest("tr")!;
    expect(within(row).getByText("Badge: 0-11152")).toBeInTheDocument();
    expect(within(row).getByText("October 13, 2026 – October 13, 2026")).toBeInTheDocument();
    expect(within(row).getByText("Ongoing")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "View Details" })).toHaveAttribute("href", "/hr/deployments/d1");
    const grouped = screen.getByRole("region", { name: "Grouped deployment assignments" });
    expect(within(grouped).getByText(/City Hall/)).toBeInTheDocument();
    expect(within(grouped).getByText("Reserve/Standby")).toBeInTheDocument();
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

  it("cancels a deployment instead of deleting it, and hides the action on cancelled rows", async () => {
    mocks.update.mockResolvedValue(undefined);
    render(<StaffDeployments />);
    const [ongoing, cancelled] = screen.getAllByRole("row").slice(1);
    expect(within(cancelled!).queryByRole("button", { name: "Delete Deployment" })).not.toBeInTheDocument();
    await userEvent.click(within(ongoing!).getByRole("button", { name: "Delete Deployment" }));
    expect(window.confirm).toHaveBeenCalledWith("Cancel or delete this deployment?");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: "d1", status: "cancelled", expectedUpdatedAt: "2026-10-01T00:00:00Z", deploymentType: "Public Assembly" }));
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Deployment cancelled" });
  });

  it("filters by the tester's deployment types", () => {
    render(<StaffDeployments />);
    const type = screen.getByRole("combobox", { name: "Deployment type" });
    expect(within(type).getAllByRole("option").map((option) => option.textContent)).toEqual(["All Deployment Types", "Public Assembly", "Special Event", "Election Security", "Disaster Response"]);
  });
});
