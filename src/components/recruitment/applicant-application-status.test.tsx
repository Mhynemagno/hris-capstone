import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyApplicationStatuses: () => ({ data: { rows: state.rows }, error: null, isLoading: false }),
}));
vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfile: () => ({ data: { first_name: "Juan", middle_name: "Santos", last_name: "Dela Cruz" }, error: null, isLoading: false }),
}));

import { ApplicantApplicationStatus } from "./applicant-application-status";

describe("ApplicantApplicationStatus", () => {
  it("shows each application's progress and only the applicant's name details", () => {
    state.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000", status: "Interview", submitted_at: "2026-09-20T00:00:00Z", job_openings: { title: "Patrolman" } }];
    render(<ApplicantApplicationStatus />);
    const card = screen.getByRole("article", { name: "Patrolman" });
    expect(within(card).getByRole("list", { name: "Application progress" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "View application" })).toHaveAttribute("href", "/applicant/applications/123e4567-e89b-42d3-a456-426614174000");
    const details = screen.getByRole("region", { name: "Application Details" });
    expect(within(details).getAllByRole("term").map((term) => term.textContent)).toEqual(["Last Name", "First Name", "Middle Name"]);
    expect(details).toHaveTextContent("Dela Cruz");
    expect(details).toHaveTextContent("Santos");
  });

  it("points applicants without an application to the job openings", () => {
    state.rows = [];
    render(<ApplicantApplicationStatus />);
    expect(screen.getByText("You have not submitted any applications yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse job openings" })).toHaveAttribute("href", "/jobs");
  });
});
