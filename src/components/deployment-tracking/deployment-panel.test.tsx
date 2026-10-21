import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), createGroup: vi.fn(), update: vi.fn(), notify: vi.fn(), deployment: { data: undefined as unknown, isLoading: false, error: null as Error | null } }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useCreateDeployment: () => ({ mutateAsync: mocks.create, isPending: false }),
  useCreateDeploymentGroup: () => ({ mutateAsync: mocks.createGroup, isPending: false }),
  useUpdateDeployment: () => ({ mutateAsync: mocks.update, isPending: false }),
  useDeployment: () => mocks.deployment,
  useEmployeeOptions: () => ({ isLoading: false, error: null, data: [{ id: "00000000-0000-4000-8000-000000000011", fullName: "Danilo Aguilar", employeeNumber: "0-11152" }] }),
}));

import { DeploymentPanel } from "./deployment-panel";

describe("DeploymentPanel (dep.html side panel)", () => {
  afterEach(() => { mocks.create.mockReset(); mocks.createGroup.mockReset(); mocks.update.mockReset(); mocks.notify.mockReset(); mocks.deployment = { data: undefined, isLoading: false, error: null }; });

  it("shows the Create Deployment fields and refuses an empty form", async () => {
    render(<DeploymentPanel mode={{ kind: "create" }} onClose={vi.fn()} />);
    const panel = screen.getByRole("dialog", { name: "Create Deployment" });
    expect(within(panel).getByText("Assign an employee to a duty location and operation.")).toBeInTheDocument();
    for (const label of ["Employees", "Location", "Deployment Type", "Event / Operation", "Start Date", "End Date"]) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    expect(within(panel).getByText("Select one or more active personnel by name or badge number.")).toBeInTheDocument();
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
    expect(within(panel).getByText("Danilo Aguilar")).toBeInTheDocument();
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

  it("says when the deployment to edit cannot be found", () => {
    mocks.deployment = { data: undefined, isLoading: false, error: new Error("not found") };
    render(<DeploymentPanel mode={{ kind: "edit", id: "00000000-0000-4000-8000-000000000099" }} onClose={vi.fn()} />);
    expect(screen.getByText("This deployment could not be found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
