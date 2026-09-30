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
    const deployment = { id: "d1", employee_id: "123e4567-e89b-42d3-a456-426614174000", location: "San Juan", unit: "Station 1", project: null, assignment_role: "Patrol", starts_on: "2026-09-25", ends_on: null, status: "active", notes: "Relief duty", updated_at: "2026-09-25T00:00:00Z" };
    render(<DeploymentForm deployment={deployment as never} onSaved={onSaved} />);
    expect(screen.queryByLabelText(/unit/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save deployment" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ unit: "Station 1" })));
  });

  it("offers a searchable employee picker without a unit or an end date input", async () => {
    const user = userEvent.setup();
    render(<DeploymentForm onSaved={vi.fn()} />);

    const employee = screen.getByRole("combobox", { name: /^employee/i });
    expect(screen.getByText("Search by name or badge number.")).toBeInTheDocument();
    await user.type(employee, "PAT-150");

    expect(await screen.findByRole("option", { name: /Ben Two/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ana One/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unit/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: "123e4567-e89b-42d3-a456-426614174002",
      location: "Headquarters",
      notes: "Relief duty",
      status: "active",
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
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
  });

  it("preserves a historic end date when an existing deployment is edited", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentForm deployment={{ id: "123e4567-e89b-42d3-a456-426614174100", employee_id: "123e4567-e89b-42d3-a456-426614174000", location: "Headquarters", unit: null, unit_station_id: null, project: null, assignment_role: "Headquarters", starts_on: "2026-01-01", ends_on: "2026-01-31", status: "active", notes: "Relief duty", created_by_user_id: "123e4567-e89b-42d3-a456-426614174001", updated_by_user_id: "123e4567-e89b-42d3-a456-426614174001", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ endsOn: "2026-01-31" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Deployment saved.");
  });
});
