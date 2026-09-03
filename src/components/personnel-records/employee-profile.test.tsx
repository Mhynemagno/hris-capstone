import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeProfilePhotoUrl: () => ({ data: null }),
  useRemoveMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { EmployeeProfile } from "./employee-profile";

const employee = {
  id: "00000000-0000-0000-0000-000000000010",
  profile_id: null,
  employee_number: "PAT-001",
  first_name: "Ada",
  middle_name: null,
  last_name: "Dela Cruz",
  rank: "Police Captain (PCPT)",
  unit_station: "Station 1",
  profile_image_path: null,
  personal_email: "ada@example.com",
  phone: null,
  address: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  department_id: null,
  position_id: null,
  employment_status: "active" as const,
  employment_started_on: "2024-01-01",
  employment_ended_on: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("EmployeeProfile", () => {
  it("uses a concise badge-number profile with an initials fallback", () => {
    render(<EmployeeProfile employee={employee} trainings={[]} />);

    expect(screen.getByRole("heading", { name: "Ada Dela Cruz" })).toBeInTheDocument();
    expect(screen.getByText("AD")).toBeInTheDocument();
    expect(screen.getByText("Badge number")).toBeInTheDocument();
    expect(screen.getByText("Police Captain (PCPT)")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided")).toHaveLength(3);
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
