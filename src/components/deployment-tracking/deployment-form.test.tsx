import { render, screen } from "@testing-library/react";
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
});
