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

vi.mock("@/hooks/use-personnel-records", () => ({
  useUnitStations: () => ({ data: [{ id: 1, name: "Station 1" }] }),
}));

describe("DeploymentForm", () => {
  it("offers a searchable employee picker and a unit assignment without an end date input", async () => {
    const user = userEvent.setup();
    render(<DeploymentForm onSaved={vi.fn()} />);

    const employee = screen.getByRole("combobox", { name: /^employee/i });
    expect(screen.getByText("Search by name or badge number.")).toBeInTheDocument();
    await user.type(employee, "PAT-150");

    expect(await screen.findByRole("option", { name: /Ben Two/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ana One/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Unit assignment")).toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("submits the employee chosen in the combobox", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentForm onSaved={onSaved} />);

    await user.type(screen.getByRole("combobox", { name: /^employee/i }), "Ben");
    await user.click(await screen.findByRole("option", { name: /Ben Two/ }));
    await user.type(screen.getByLabelText(/^assignment role/i), "Patrol");
    await user.type(screen.getByLabelText("Location"), "Headquarters");
    await user.type(screen.getByLabelText(/^start date/i), "2026-02-01");
    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: "123e4567-e89b-42d3-a456-426614174002",
      assignmentRole: "Patrol",
      status: "active",
    })));
  });

  it("shows inline errors for a missing employee and assignment role", async () => {
    const user = userEvent.setup();
    render(<DeploymentForm onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    expect(screen.getByText("Choose an employee.")).toBeInTheDocument();
    expect(screen.getByText("Assignment role is required.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
  });

  it("preserves a historic end date when an existing deployment is edited", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentForm deployment={{ id: "123e4567-e89b-42d3-a456-426614174100", employee_id: "123e4567-e89b-42d3-a456-426614174000", location: "Headquarters", unit: null, unit_station_id: null, project: null, assignment_role: "Patrol", starts_on: "2026-01-01", ends_on: "2026-01-31", status: "active", notes: null, created_by_user_id: "123e4567-e89b-42d3-a456-426614174001", updated_by_user_id: "123e4567-e89b-42d3-a456-426614174001", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ endsOn: "2026-01-31" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Deployment saved.");
  });
});
