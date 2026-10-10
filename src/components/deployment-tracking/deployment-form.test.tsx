import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeploymentForm } from "./deployment-form";

vi.mock("@/hooks/use-deployment-tracking", () => ({
  useEmployeeOptions: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: "123e4567-e89b-42d3-a456-426614174000", employeeNumber: "PAT-001", fullName: "Ana One" },
      { id: "123e4567-e89b-42d3-a456-426614174002", employeeNumber: "PAT-150", fullName: "Ben Two" },
    ],
  }),
}));

describe("DeploymentForm", () => {
  it("no longer asks for a unit but keeps a saved unit when editing", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const deployment = { id: "d1", employee_id: "123e4567-e89b-42d3-a456-426614174000", location: "San Juan", unit: "Station 1", project: null, assignment_role: "Patrol", starts_on: "2026-09-25", ends_on: null, status: "ongoing", deployment_type: "Special Event", event_operation: "Fiesta / Major Event", notes: "Relief duty", updated_at: "2026-09-25T00:00:00Z" };
    render(<DeploymentForm deployment={deployment as never} onSaved={onSaved} />);
    expect(screen.queryByLabelText(/unit/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save deployment" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ unit: "Station 1" })));
  });

  it("lets HR set an optional end date and sends it", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const deployment = { id: "d1", employee_id: "123e4567-e89b-42d3-a456-426614174000", location: "San Juan", unit: null, project: null, assignment_role: "San Juan", starts_on: "2026-09-25", ends_on: null, status: "scheduled", deployment_type: "Special Event", event_operation: "Fiesta / Major Event", notes: "Relief duty", updated_at: "2026-09-25T00:00:00Z" };
    render(<DeploymentForm deployment={deployment as never} onSaved={onSaved} />);
    await user.type(screen.getByLabelText(/^End date/), "2026-09-27");
    await user.click(screen.getByRole("button", { name: "Save deployment" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ endsOn: "2026-09-27" })));
  });

  it("offers a searchable employee picker without a unit input", async () => {
    const user = userEvent.setup();
    render(<DeploymentForm onSaved={vi.fn()} />);

    const employee = screen.getByRole("combobox", { name: /^employee/i });
    expect(screen.getByText("Search by name or badge number.")).toBeInTheDocument();
    await user.type(employee, "PAT-150");

    expect(await screen.findByRole("option", { name: /Ben Two/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ana One/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unit/i)).not.toBeInTheDocument();
  });

  it("submits the employee chosen in the combobox", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentForm onSaved={onSaved} />);

    await user.type(screen.getByRole("combobox", { name: /^employee/i }), "Ben");
    await user.click(await screen.findByRole("option", { name: /Ben Two/ }));
    await user.type(screen.getByLabelText(/^location/i), "Headquarters");
    await user.type(screen.getByLabelText(/^remarks/i), "Relief duty");
    await user.type(screen.getByLabelText(/^start date/i), "2026-02-01");
    await user.selectOptions(screen.getByLabelText(/^deployment type/i), "Election Security");
    await user.selectOptions(screen.getByLabelText(/^event \/ operation/i), "Election Period");
    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: "123e4567-e89b-42d3-a456-426614174002",
      location: "Headquarters",
      notes: "Relief duty",
      status: "scheduled",
      deploymentType: "Election Security",
      eventOperation: "Election Period",
    })));
  });

  it("has no assignment role, project, or destination hint, and marks location and remarks required", () => {
    render(<DeploymentForm onSaved={vi.fn()} />);

    expect(screen.queryByLabelText(/assignment role/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^project/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^notes/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Provide a location, unit, or project.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^location/i)).toBeRequired();
    expect(screen.getByLabelText(/^remarks/i)).toBeRequired();
    expect(screen.getByText("Location").querySelector("span")).toHaveTextContent("*");
    expect(screen.getByText("Remarks").querySelector("span")).toHaveTextContent("*");
  });

  it("shows inline errors for a missing employee, location, and remarks", async () => {
    const user = userEvent.setup();
    render(<DeploymentForm onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    expect(screen.getByText("Choose an employee.")).toBeInTheDocument();
    expect(screen.getByText("Location is required.")).toBeInTheDocument();
    expect(screen.getByText("Remarks are required.")).toBeInTheDocument();
    expect(screen.getByText("Select a deployment type.")).toBeInTheDocument();
    expect(screen.getByText("Select an event / operation.")).toBeInTheDocument();
  });

  it("offers the tester's deployment type, event / operation, and status options", () => {
    render(<DeploymentForm onSaved={vi.fn()} />);
    const options = (label: RegExp) => [...(screen.getByLabelText(label) as HTMLSelectElement).options].map((option) => option.text);

    expect(options(/^deployment type/i)).toEqual(["Select a deployment type", "Public Assembly", "Special Event", "Election Security", "Disaster Response"]);
    expect(options(/^event \/ operation/i)).toEqual(["Select an event / operation", "Rally", "Fiesta / Major Event", "Election Period", "Flood / Emergency", "Government Event"]);
    expect(options(/^status/i)).toEqual(["Scheduled", "Ongoing", "Completed", "Cancelled"]);
    expect(screen.getByLabelText(/^status/i)).toHaveValue("scheduled");
  });

  it("preserves a historic end date when an existing deployment is edited", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentForm deployment={{ id: "123e4567-e89b-42d3-a456-426614174100", employee_id: "123e4567-e89b-42d3-a456-426614174000", location: "Headquarters", unit: null, unit_station_id: null, project: null, assignment_role: "Headquarters", starts_on: "2026-01-01", ends_on: "2026-01-31", status: "completed", deployment_type: "Disaster Response", event_operation: "Flood / Emergency", notes: "Relief duty", created_by_user_id: "123e4567-e89b-42d3-a456-426614174001", updated_by_user_id: "123e4567-e89b-42d3-a456-426614174001", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ endsOn: "2026-01-31" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Deployment saved.");
  });
});
