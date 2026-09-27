import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const base = { applicant_id: "a", applicant_number: 12, qualifier: null, full_name: null, email_confirmed: true, application_count: 0, latest_application_id: null, latest_application_status: null, latest_job_title: null, latest_submitted_at: null, registered_at: "2026-09-20T00:00:00Z" };
const rows = [
  { ...base, user_id: "u1", first_name: "Juan", middle_name: "Santos", last_name: "Dela Cruz", email: "juan@example.com", phone: "+639171234567", email_confirmed: false },
  { ...base, user_id: "u2", first_name: "Ana", middle_name: null, last_name: "Reyes", email: "ana@example.com", phone: null, application_count: 2, latest_application_id: "123e4567-e89b-42d3-a456-426614174000", latest_application_status: "Interview", latest_job_title: "Patrolman" },
];

vi.mock("@/hooks/use-applicant-portal", () => ({ useHrRegisteredApplicants: () => ({ data: rows, error: null, isLoading: false }) }));

import { HrRegisteredApplicantList } from "./hr-registered-applicant-list";

describe("HrRegisteredApplicantList", () => {
  it("lists registered applicants including those without an application", () => {
    render(<HrRegisteredApplicantList />);
    const [, first, second] = screen.getAllByRole("row");
    expect(first).toHaveTextContent("Dela Cruz, Juan Santos");
    expect(first).toHaveTextContent("juan@example.com");
    expect(first).toHaveTextContent("Email not confirmed");
    expect(first).toHaveTextContent("+639171234567");
    expect(first).toHaveTextContent("No application yet");
    expect(second).toHaveTextContent("Interview");
    expect(second).not.toHaveTextContent("Patrolman");
    expect(first).toHaveTextContent("September 20, 2026");
    expect(within(second!).getByRole("link", { name: /Review/ })).toHaveAttribute("href", "/hr/applications/123e4567-e89b-42d3-a456-426614174000");
  });

  it("filters by name, email, or mobile", () => {
    render(<HrRegisteredApplicantList />);
    fireEvent.change(screen.getByLabelText("Search applicants"), { target: { value: "ana@" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("1 applicant")).toBeInTheDocument();
  });
});
