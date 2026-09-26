import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeProfilePhotoUrl: () => ({ data: null }),
  useRemoveMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({ data: [{ id: 3, name: "Intelligence Section", is_active: true }] }),
  useRankOptions: () => ({ data: [{ id: 9, name: "Police Captain", code: "PCapt", sort_order: 9, is_active: true, created_at: "", updated_at: "" }] }),
}));

import { EmployeeProfile } from "./employee-profile";

const employee = {
  id: "00000000-0000-0000-0000-000000000010",
  profile_id: null,
  employee_number: "PAT-001",
  first_name: "Ada",
  middle_name: null,
  last_name: "Dela Cruz",
  qualifier: null,
  place_of_birth: null,
  date_of_birth: null,
  gender: null,
  civil_status: null,
  religion: null,
  unit_station: "Station 1",
  profile_image_path: null,
  personal_email: "ada@example.com",
  phone: null,
  address: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  department_id: null,
  rank_id: 9,
  employment_status: "active" as const,
  employment_started_on: "2024-01-01",
  employment_ended_on: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("EmployeeProfile", () => {
  it("uses a concise badge-number profile with the default avatar fallback", () => {
    render(<EmployeeProfile employee={employee} trainings={[]} />);

    expect(screen.getByRole("heading", { name: "Ada Dela Cruz" })).toBeInTheDocument();
    expect(screen.getByAltText("Default profile avatar")).toBeInTheDocument();
    expect(screen.getByText("Badge number")).toBeInTheDocument();
    expect(screen.getByText("PCapt — Police Captain")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided")).toHaveLength(9);
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
  });

  it("groups contact details into cards and shows header actions", () => {
    render(<EmployeeProfile actions={<a href="/employee/profile/change-request">Request profile change</a>} employee={{ ...employee, department_id: 3, phone: "09171234567" }} trainings={[]} />);

    expect(screen.getByRole("region", { name: "Contact information" })).toHaveTextContent("09171234567");
    expect(screen.getByRole("region", { name: "Emergency contact" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Address information" })).toBeInTheDocument();
    expect(screen.getByText("Intelligence Section")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request profile change" })).toBeInTheDocument();
  });

  it("keeps trainings visible as promotion evidence", () => {
    render(<EmployeeProfile employee={employee} trainings={[{
      id: "00000000-0000-0000-0000-000000000020",
      employee_id: employee.id,
      course_name: "Leadership Development",
      provider: "Police Academy",
      completed_on: "2026-01-01",
      expires_on: null,
      hours: 16,
      notes: null,
    }]} />);

    expect(screen.getByRole("heading", { name: "Training" })).toBeInTheDocument();
    expect(screen.getByText("Leadership Development")).toBeInTheDocument();
    expect(screen.getByText(/16 hours/i)).toBeInTheDocument();
  });
});
