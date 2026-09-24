import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useEmployeeDirectory: vi.fn() }));

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeDirectory: mocks.useEmployeeDirectory,
  useUnlinkedEmployeeAccounts: () => ({ data: undefined, isLoading: false, error: null }),
}));

vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: 3, name: "Operations", is_active: true, created_at: "", updated_at: "" },
      { id: 4, name: "Records", is_active: false, created_at: "", updated_at: "" },
    ],
  }),
  usePositionOptions: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: 7, department_id: 3, title: "Patrol Officer", code: null, description: null, is_active: true, created_at: "", updated_at: "" },
      { id: 9, department_id: 4, title: "Records Clerk", code: null, description: null, is_active: true, created_at: "", updated_at: "" },
    ],
  }),
}));

import { EmployeeDirectory } from "./employee-directory";

const employee = {
  id: "00000000-0000-4000-8000-000000000010",
  first_name: "Ana",
  last_name: "Reyes",
  employee_number: "PAT-0001",
  department_id: 3,
  position_id: 7,
  employment_status: "on_leave",
};

describe("EmployeeDirectory", () => {
  beforeEach(() => {
    mocks.useEmployeeDirectory.mockReset();
    mocks.useEmployeeDirectory.mockReturnValue({ data: { rows: [employee], count: 1 }, error: null, isLoading: false });
  });

  it("lists records in an accessible table with department, position, and a visible action", () => {
    render(<EmployeeDirectory />);

    const table = screen.getByRole("table", { name: "Personnel records" });
    expect(within(table).getByRole("cell", { name: "Operations" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "Patrol Officer" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "On leave" })).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: /view record for ana reyes/i })).toHaveAttribute("href", `/hr/employees/${employee.id}`);
    expect(screen.getByText("1 record")).toBeInTheDocument();
  });

  it("filters by department, dependent position, and employment status, then clears", async () => {
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
    expect(screen.getByLabelText("Position")).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Department"), "3");
    expect(within(screen.getByLabelText("Position")).queryByRole("option", { name: "Records Clerk" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Position"), "7");
    await user.selectOptions(screen.getByLabelText("Employment status"), "on_leave");

    expect(mocks.useEmployeeDirectory).toHaveBeenLastCalledWith(expect.objectContaining({ departmentId: 3, positionId: 7, employmentStatus: "on_leave" }));
    // Filters can find records in inactive departments.
    expect(screen.getByRole("option", { name: "Records (inactive)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(mocks.useEmployeeDirectory).toHaveBeenLastCalledWith({ search: "", departmentId: undefined, positionId: undefined, employmentStatus: undefined });
  });

  it("explains an empty filtered result", async () => {
    mocks.useEmployeeDirectory.mockReturnValue({ data: { rows: [], count: 0 }, error: null, isLoading: false });
    const user = userEvent.setup();
    render(<EmployeeDirectory />);

    expect(screen.getByRole("link", { name: "Add the first employee" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search"), "zzz");
    expect(screen.getByText(/No personnel records match these filters/)).toBeInTheDocument();
  });
});
