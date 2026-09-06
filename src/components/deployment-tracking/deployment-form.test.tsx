import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeploymentForm } from "./deployment-form";

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeDirectory: () => ({ data: { rows: [{ id: "123e4567-e89b-42d3-a456-426614174000", employee_number: "PAT-001", first_name: "Ana", last_name: "One" }] } }),
  useUnitStations: () => ({ data: [{ id: 1, name: "Station 1" }] }),
}));

describe("DeploymentForm", () => {
  it("selects an employee by badge number and a unit assignment without an end date input", () => {
    render(<DeploymentForm onSaved={vi.fn()} />);
    expect(screen.getByLabelText("Badge number")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /PAT-001/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Unit assignment")).toBeInTheDocument();
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
  });

  it("preserves a historic end date when an existing deployment is edited", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<DeploymentForm deployment={{ id: "123e4567-e89b-42d3-a456-426614174100", employee_id: "123e4567-e89b-42d3-a456-426614174000", location: "Headquarters", unit: null, unit_station_id: null, project: null, assignment_role: "Patrol", starts_on: "2026-01-01", ends_on: "2026-01-31", status: "active", notes: null, created_by_user_id: "123e4567-e89b-42d3-a456-426614174001", updated_by_user_id: "123e4567-e89b-42d3-a456-426614174001", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: "Save deployment" }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ endsOn: "2026-01-31" }));
  });
});
