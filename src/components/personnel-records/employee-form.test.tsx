import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmployeeForm } from "./employee-form";

vi.mock("@/hooks/use-personnel-records", () => ({
  useUnitStations: () => ({ data: [{ id: 1, name: "Station 1", is_active: true }], error: null }),
}));

const stamp = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({
    data: [
      { id: 3, name: "Operations", is_active: true, ...stamp },
      { id: 4, name: "Records", is_active: true, ...stamp },
      { id: 5, name: "Legacy Unit", is_active: false, ...stamp },
    ],
    isLoading: false,
    error: null,
  }),
  useRankOptions: () => ({
    data: [
      { id: 7, name: "Patrolman / Patrolwoman", code: "Pat", sort_order: 1, is_active: true, ...stamp },
      { id: 8, name: "Retired Rank", code: "RET", sort_order: 2, is_active: false, ...stamp },
      { id: 9, name: "Police Corporal", code: "PCpl", sort_order: 3, is_active: true, ...stamp },
    ],
    isLoading: false,
    error: null,
  }),
}));

const existingEmployee = {
  id: "00000000-0000-4000-8000-000000000010",
  profile_id: "00000000-0000-4000-8000-000000001604",
  employee_number: "1-00001",
  first_name: "Ana",
  middle_name: null,
  last_name: "Reyes",
  qualifier: null,
  place_of_birth: null,
  date_of_birth: null,
  gender: null,
  civil_status: null,
  religion: null,
  unit_station: null,
  profile_image_path: null,
  personal_email: "ana@example.test",
  phone: null,
  address: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  department_id: 3,
  rank_id: 8,
  employment_status: "active" as const,
  employment_started_on: "2024-01-01",
  employment_ended_on: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("EmployeeForm", () => {
  it("exposes labelled official record fields and a save action", () => {
    render(<EmployeeForm onSaved={() => undefined} />);

    expect(screen.getByLabelText(/badge number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rank/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unit.*station/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Station 1" })).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Place of birth")).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth")).toBeInTheDocument();
    expect(screen.getByLabelText("Civil status")).toBeInTheDocument();
    expect(screen.getByLabelText("Gender")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sex")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Position")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/employment start date/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save employee/i })).toHaveClass("w-full");
  });

  it("prefills and binds a selected Employee account when creating its first personnel record", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <EmployeeForm
        account={{
          profile_id: "00000000-0000-4000-8000-000000001604",
          first_name: "Ariun",
          last_name: "Bold",
          full_name: "Ariun Bold",
          email: "candidate.employee@example.test",
        }}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ariun");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("Bold");
    expect(screen.getByLabelText(/personal email/i)).toHaveValue("candidate.employee@example.test");
    expect(container.querySelector('input[name="profileId"]')).toHaveValue("00000000-0000-4000-8000-000000001604");

    await user.type(screen.getByLabelText(/badge number/i), "a1b23456789");
    expect(screen.getByLabelText(/badge number/i)).toHaveValue("1-23456");
    await user.type(screen.getByLabelText(/employment start date/i), "2024-01-01");
    await user.click(screen.getByRole("button", { name: /save employee/i }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "00000000-0000-4000-8000-000000001604",
      firstName: "Ariun",
      lastName: "Bold",
      personalEmail: "candidate.employee@example.test",
      employeeNumber: "1-23456",
    }));
  });

  it("shows Badge number validation next to the field", async () => {
    const user = userEvent.setup();
    render(<EmployeeForm onSaved={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /save employee/i }));

    expect(screen.getByLabelText(/badge number/i).parentElement).toHaveTextContent("Enter the badge number.");

    await user.type(screen.getByLabelText(/badge number/i), "123");
    await user.click(screen.getByRole("button", { name: /save employee/i }));
    expect(screen.getByLabelText(/badge number/i).parentElement).toHaveTextContent("Badge number must be 6 digits in the format 0-00000.");
  });

  it("keeps the linked account, department, and rank when an existing employee is edited", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<EmployeeForm employee={existingEmployee} onSaved={onSaved} />);

    expect(container.querySelector('input[name="profileId"]')).toHaveValue(existingEmployee.profile_id);
    expect(screen.getByLabelText("Department")).toHaveValue("3");
    // The saved rank is inactive but remains visible and selected.
    expect(screen.getByLabelText("Rank")).toHaveValue("8");
    expect(screen.getByRole("option", { name: "RET — Retired Rank (inactive)" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/first name/i));
    await user.type(screen.getByLabelText(/first name/i), "Anna");
    await user.click(screen.getByRole("button", { name: /save employee/i }));

    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "Anna",
      profileId: existingEmployee.profile_id,
      departmentId: 3,
      rankId: 8,
    }));
  });

  it("offers every active rank in every department and keeps the rank when the department changes", async () => {
    const user = userEvent.setup();
    render(<EmployeeForm employee={existingEmployee} onSaved={() => undefined} />);

    const rank = screen.getByLabelText("Rank");
    expect(within(rank).getByRole("option", { name: "Pat — Patrolman / Patrolwoman" })).toBeInTheDocument();
    expect(within(rank).getByRole("option", { name: "PCpl — Police Corporal" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /legacy unit/i })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Department"), "4");

    expect(rank).toHaveValue("8");
    expect(within(rank).getByRole("option", { name: "PCpl — Police Corporal" })).toBeInTheDocument();
  });

  it("offers only the Active and On leave employment statuses", () => {
    render(<EmployeeForm employee={existingEmployee} onSaved={() => undefined} />);

    const status = screen.getByLabelText(/employment status/i);
    expect(within(status).getAllByRole("option").map((option) => option.textContent)).toEqual(["Active", "On leave"]);
  });

  it("uses telephone inputs for phone numbers and ties the end date minimum to the start date", () => {
    render(<EmployeeForm employee={existingEmployee} onSaved={() => undefined} />);

    expect(screen.getByLabelText("Phone")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText("Emergency contact phone")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText(/employment end date/i)).toHaveAttribute("min", "2024-01-01");
  });
});
