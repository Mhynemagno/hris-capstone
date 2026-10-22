import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createGroup: vi.fn(), update: vi.fn(), notify: vi.fn(), onLeave: [] as string[], deployment: { data: undefined as unknown, isLoading: false, error: null as Error | null } }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useCreateDeploymentGroup: () => ({ mutateAsync: mocks.createGroup, isPending: false }),
  useUpdateDeployment: () => ({ mutateAsync: mocks.update, isPending: false }),
  useDeployment: () => mocks.deployment,
  useEmployeeOptions: () => ({ isLoading: false, error: null, data: [
    { id: "00000000-0000-4000-8000-000000000011", fullName: "Danilo Aguilar", employeeNumber: "0-11152", rank: "PCPL", rankSortOrder: 2, department: "Investigation" },
    { id: "00000000-0000-4000-8000-000000000012", fullName: "Bea Santos", employeeNumber: "0-22222", rank: "PAT", rankSortOrder: 1, department: "Traffic" },
    { id: "00000000-0000-4000-8000-000000000013", fullName: "Carlo Reyes", employeeNumber: "0-33333", rank: "PCPL", rankSortOrder: 2, department: "Traffic" },
  ] }),
  useEmployeesOnLeave: () => ({ isLoading: false, error: null, data: mocks.onLeave }),
}));

import { DeploymentPanel } from "./deployment-panel";

describe("DeploymentPanel (dep.html side panel)", () => {
  afterEach(() => { mocks.onLeave = []; mocks.createGroup.mockReset(); mocks.update.mockReset(); mocks.notify.mockReset(); mocks.deployment = { data: undefined, isLoading: false, error: null }; });

  it("shows the Create Deployment fields and refuses an empty form", async () => {
    render(<DeploymentPanel mode={{ kind: "create" }} onClose={vi.fn()} />);
    const panel = screen.getByRole("dialog", { name: "Create Deployment" });
    expect(within(panel).getByText("Assign one or more employees to a duty location and operation.")).toBeInTheDocument();
    for (const label of ["Employees", "Location", "Deployment Type", "Event / Operation", "Start Date", "End Date"]) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    expect(within(panel).getByText(/^Select one or more active personnel by name or badge number\./)).toBeInTheDocument();
    expect(within(panel).queryByText(/Remarks/)).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText(/^Status/)).not.toBeInTheDocument();
    expect(within(panel).getByText("Optional. Leave blank for ongoing duty.")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    expect(within(panel).getByText("Choose at least one employee.")).toBeInTheDocument();
    expect(within(panel).getByText("Location is required.")).toBeInTheDocument();
    expect(mocks.createGroup).not.toHaveBeenCalled();
  });

  it("saves a new deployment once and closes", async () => {
    const onClose = vi.fn();
    mocks.createGroup.mockResolvedValue("group-1");
    render(<DeploymentPanel mode={{ kind: "create" }} onClose={onClose} />);
    const panel = screen.getByRole("dialog", { name: "Create Deployment" });
    await userEvent.type(within(panel).getByRole("combobox", { name: /^Employees/ }), "Dan");
    await userEvent.click(await screen.findByRole("option", { name: /Danilo Aguilar/ }));
    const selected = within(panel).getByRole("list", { name: "Selected employees" });
    expect(within(selected).getByText("Danilo Aguilar")).toBeInTheDocument();
    expect(within(selected).getByText("PCPL")).toBeInTheDocument();
    expect(within(selected).getByText("Badge: 0-11152")).toBeInTheDocument();
    expect(within(panel).getByLabelText(/^Task for Danilo Aguilar/)).toHaveValue("Deployed");
    await userEvent.type(within(panel).getByLabelText(/^Location/), "Greenhills Sector");
    await userEvent.selectOptions(within(panel).getByLabelText(/^Deployment Type/), "Public Assembly");
    await userEvent.selectOptions(within(panel).getByLabelText(/^Event \/ Operation/), "Rally");
    await userEvent.type(within(panel).getByLabelText(/^Start Date/), "2026-10-13");
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.createGroup).toHaveBeenCalledTimes(1));
    expect(mocks.createGroup).toHaveBeenCalledWith(expect.objectContaining({ location: "Greenhills Sector", endsOn: null, assignments: [{ employeeId: "00000000-0000-4000-8000-000000000011", task: "Deployed" }] }));
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Deployment saved" });
    expect(onClose).toHaveBeenCalled();
  });

  it("filters the picker by rank and unit/section, ordered by rank, and hides selected personnel", async () => {
    render(<DeploymentPanel mode={{ kind: "create" }} onClose={vi.fn()} />);
    const panel = screen.getByRole("dialog", { name: "Create Deployment" });
    const rank = within(panel).getByLabelText("Filter by rank");
    expect(within(rank).getAllByRole("option").map((option) => option.textContent)).toEqual(["All ranks", "PAT", "PCPL"]);
    await userEvent.selectOptions(rank, "PCPL");
    await userEvent.selectOptions(within(panel).getByLabelText("Filter by unit or section"), "Traffic");
    await userEvent.click(within(panel).getByRole("combobox", { name: /^Employees/ }));
    expect(await screen.findByRole("option", { name: /Carlo Reyes/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Danilo Aguilar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Bea Santos/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /Carlo Reyes/ }));
    await userEvent.click(within(panel).getByRole("combobox", { name: /^Employees/ }));
    expect(screen.queryByRole("option", { name: /Carlo Reyes/ })).not.toBeInTheDocument();
  });

  it("leaves personnel on leave out of the picker and lists them, not selectable, under On leave", async () => {
    mocks.onLeave = ["00000000-0000-4000-8000-000000000012"];
    render(<DeploymentPanel mode={{ kind: "create" }} onClose={vi.fn()} />);
    const panel = screen.getByRole("dialog", { name: "Create Deployment" });
    await userEvent.click(within(panel).getByRole("combobox", { name: /^Employees/ }));
    expect(await screen.findByRole("option", { name: /Danilo Aguilar/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Bea Santos/ })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.selectOptions(within(panel).getByLabelText("Availability"), "on-leave");
    const onLeave = within(panel).getByRole("list", { name: "Personnel on leave" });
    expect(within(onLeave).getByText("Bea Santos")).toBeInTheDocument();
    expect(within(onLeave).getByText("On leave")).toBeInTheDocument();
    expect(within(onLeave).queryByText("Danilo Aguilar")).not.toBeInTheDocument();
    expect(within(onLeave).queryByRole("button")).not.toBeInTheDocument();
  });

  it("edits task and type-dependent event without status or remarks", async () => {
    const onClose = vi.fn();
    mocks.update.mockResolvedValue(undefined);
    mocks.deployment = { isLoading: false, error: null, data: {
      id: "00000000-0000-4000-8000-000000000099", employee_id: "e1", location: "Plaza", unit: null, task: "Deployed", status: "scheduled",
      starts_on: "2026-10-20", ends_on: null, deployment_type: "Public Assembly", event_operation: "Fiesta / Major Event", notes: "old",
      updated_at: "2026-10-01T00:00:00Z", proposed_status: null,
      employee: { id: "e1", employee_number: "0-11152", first_name: "Danilo", middle_name: null, last_name: "Aguilar", qualifier: null, rank: { code: "PCPL" } },
    } };
    render(<DeploymentPanel mode={{ kind: "edit", id: "00000000-0000-4000-8000-000000000099" }} onClose={onClose} />);
    const panel = screen.getByRole("dialog", { name: "Edit Deployment" });
    expect(within(panel).queryByText(/Remarks/)).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText(/^Status/)).not.toBeInTheDocument();
    const event = within(panel).getByLabelText(/^Event \/ Operation/);
    // The legacy event does not belong to Public Assembly, so it must be chosen again.
    expect(event).toHaveValue("");
    expect(within(event).getAllByRole("option").map((option) => option.textContent)).toEqual(["Select event / operation", "Rally"]);
    await userEvent.selectOptions(within(panel).getByLabelText(/^Deployment Type/), "Special Event");
    expect(within(event).getAllByRole("option").map((option) => option.textContent)).toEqual(["Select event / operation", "Fiesta / Major Event", "Government Event"]);
    await userEvent.selectOptions(event, "Government Event");
    await userEvent.selectOptions(within(panel).getByLabelText(/^Task/), "Reserve/Standby");
    await userEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith({ id: "00000000-0000-4000-8000-000000000099", expectedUpdatedAt: "2026-10-01T00:00:00Z", location: "Plaza", startsOn: "2026-10-20", endsOn: null, deploymentType: "Special Event", eventOperation: "Government Event", task: "Reserve/Standby" });
    expect(onClose).toHaveBeenCalled();
  });

  it("says when the deployment to edit cannot be found", () => {
    mocks.deployment = { data: undefined, isLoading: false, error: new Error("not found") };
    render(<DeploymentPanel mode={{ kind: "edit", id: "00000000-0000-4000-8000-000000000099" }} onClose={vi.fn()} />);
    expect(screen.getByText("This deployment could not be found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
