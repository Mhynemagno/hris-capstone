import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeProfilePhotoUrl: () => ({ data: null }),
  useRemoveMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateMyGovernmentIds: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({ data: [{ id: 3, name: "Intelligence Section", is_active: true }] }),
  useRankOptions: () => ({ data: [{ id: 9, name: "Police Captain", code: "PCPT", sort_order: 9, is_active: true, created_at: "", updated_at: "" }] }),
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
  sss_number: null,
  philhealth_number: null,
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
    expect(screen.getByText("PCPT — Police Captain")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided")).toHaveLength(11); // includes the SSS and PhilHealth numbers
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

  it("shows only the name, rank, and key service facts on the dashboard summary", () => {
    render(<EmployeeProfile canManagePhoto employee={{ ...employee, gender: "male", date_of_birth: "1990-01-01", department_id: 3 }} trainings={[]} variant="summary" />);

    expect(screen.getByRole("heading", { name: "Ada Dela Cruz" })).toBeInTheDocument();
    expect(screen.getByText("PCPT — Police Captain")).toBeInTheDocument();
    for (const label of ["Badge number", "Status", "Years of service", "Unit / Section", "Unit / Station"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Intelligence Section")).toBeInTheDocument();
    expect(screen.queryByText("Gender")).not.toBeInTheDocument();
    expect(screen.queryByText("Born")).not.toBeInTheDocument();
    expect(screen.queryByText(/In service since/)).not.toBeInTheDocument();
    expect(screen.queryByAltText("Default profile avatar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/profile photo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Contact information" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Emergency contact" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Training records" })).not.toBeInTheDocument();
  });

  it("no longer shows a separate training timeline", () => {
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

    expect(screen.queryByRole("heading", { name: "Training records" })).not.toBeInTheDocument();
  });

  it("shows eligibility read-only, and service history and certifications only when recorded", () => {
    const { rerender } = render(<EmployeeProfile employee={employee} qualifications={[{ id: "q1", employee_id: employee.id, name: "Career Service Professional", institution: "Civil Service Commission", qualification_level: "Second level", field_of_study: null, awarded_on: "2019-05-01", notes: null }]} trainings={[]} />);

    const eligibility = screen.getByRole("region", { name: "Eligibility" });
    expect(eligibility).toHaveTextContent("Career Service Professional");
    expect(eligibility).toHaveTextContent("May 1, 2019");
    expect(eligibility).not.toHaveTextContent("Civil Service Commission");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Service history" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Certification / Training" })).not.toBeInTheDocument();

    rerender(<EmployeeProfile certifications={[{ id: "c1", employee_id: employee.id, name: "First Aid", issuer: "Red Cross", credential_id: null, issued_on: "2025-02-01", expires_on: null, notes: null }]} employee={employee} qualifications={[]} serviceHistory={[{ id: "s1", employee_id: employee.id, department_id: 3, rank_id: 9, employment_title: null, started_on: "2024-01-01", ended_on: null, notes: null }]} trainings={[]} />);

    expect(screen.getByRole("region", { name: "Eligibility" })).toHaveTextContent("No eligibility recorded.");
    expect(screen.getByRole("region", { name: "Service history" })).toHaveTextContent("PCPT — Police Captain");
    expect(screen.getByRole("region", { name: "Service history" })).toHaveTextContent(/Intelligence Section · January 1, 2024 – present/);
    expect(screen.getByRole("region", { name: "Certification / Training" })).toHaveTextContent("First Aid");
    expect(screen.getByRole("region", { name: "Certification / Training" })).toHaveTextContent("Completed February 1, 2025");
  });

  it("hides eligibility when it is not provided (administrator view)", () => {
    render(<EmployeeProfile employee={employee} trainings={[]} />);
    expect(screen.queryByRole("region", { name: "Eligibility" })).not.toBeInTheDocument();
  });
});
