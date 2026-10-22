import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  employee: { data: null as unknown, isLoading: false, error: null as Error | null },
  entries: {} as Record<string, { data?: unknown[]; isLoading?: boolean; error?: Error | null }>,
}));

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeForCurrentUser: () => state.employee,
  usePersonnelEntries: (kind: string, employeeId: string) => (employeeId ? state.entries[kind] ?? { data: [] } : { data: undefined }),
  useEmployeeProfilePhotoUrl: () => ({ data: null }),
  useEmployeeTimeInGrade: () => ({ isLoading: false, data: "2021-07-01" }),
  useRemoveMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplaceMyEmployeeProfilePhoto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateMyGovernmentIds: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReplacePersonnelDocument: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRemovePersonnelDocument: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({ data: [] }),
  useRankOptions: () => ({ data: [{ id: 9, name: "Police Captain", code: "PCPT", sort_order: 9, is_active: true, created_at: "", updated_at: "" }] }),
}));

import { EmployeeRecordSummary } from "./employee-record-summary";

const employee = {
  id: "00000000-0000-0000-0000-000000000010", profile_id: null, employee_number: "PAT-001", first_name: "Ada", middle_name: null, last_name: "Dela Cruz", qualifier: null,
  place_of_birth: null, date_of_birth: "1990-01-15", gender: "female", civil_status: null, religion: null, unit_station: "Station 1", profile_image_path: null,
  personal_email: "ada@example.com", phone: null, address: null, emergency_contact_name: null, emergency_contact_phone: null, sss_number: null, philhealth_number: null,
  gsis_number: null, pagibig_number: null, department_id: null, rank_id: 9, employment_status: "active", employment_started_on: "2024-01-01", employment_ended_on: null,
  created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
};

beforeEach(() => {
  state.employee = { data: employee, isLoading: false, error: null };
  state.entries = {};
});

describe("EmployeeRecordSummary", () => {
  it("shows the personnel card with separate eligibility and certification / training cards", () => {
    render(<EmployeeRecordSummary actions={<a href="/employee/profile/change-request">Request Profile Change</a>} />);

    expect(screen.getByRole("link", { name: "Request Profile Change" })).toHaveAttribute("href", "/employee/profile/change-request");
    expect(screen.getByRole("region", { name: "Eligibility" })).toHaveTextContent("No eligibility recorded.");
    expect(screen.getByText("Certification / Training")).toBeVisible();
    expect(screen.getByRole("region", { name: "Certification / Training" })).toHaveTextContent("No certification or training recorded.");
    expect(screen.getByText("Active")).toBeVisible();
  });

  it("does not claim records are empty while they are still loading", () => {
    state.entries = { qualification: { isLoading: true }, certification: { isLoading: true } };
    render(<EmployeeRecordSummary />);

    expect(screen.getByText(/Loading your personnel records/)).toBeVisible();
    expect(screen.queryByText("No eligibility recorded.")).not.toBeInTheDocument();
  });

  it("shows an error instead of an empty state when a record query fails", () => {
    state.entries = { certification: { error: new Error("Certifications unavailable") } };
    render(<EmployeeRecordSummary />);

    expect(screen.getByText("Certifications unavailable")).toBeVisible();
    expect(screen.queryByText("No eligibility recorded.")).not.toBeInTheDocument();
  });

  it("renders a stored document only as a read-only View action for the employee", () => {
    state.entries = {
      qualification: { data: [
        { id: "q1", employee_id: employee.id, name: "RCrim Licensure", awarded_on: "2022-06-14", notes: null, document_path: "qualifications/x/rcrim.pdf", document_name: "rcrim.pdf", document_mime_type: "application/pdf", document_size_bytes: 1000 },
        { id: "q2", employee_id: employee.id, name: "Civil Service", awarded_on: "2019-05-01", notes: null, document_path: null, document_name: null },
      ] },
    };
    render(<EmployeeRecordSummary />);

    expect(screen.getByRole("button", { name: "Open rcrim.pdf" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Upload document|Replace|Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View/ })).not.toBeInTheDocument();
  });

  it("explains an unlinked account", () => {
    state.employee = { data: null, isLoading: false, error: null };
    render(<EmployeeRecordSummary />);
    expect(screen.getByText(/has not been linked/)).toBeVisible();
  });
});
