import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyApplicationStatuses: () => ({ data: { rows: state.rows }, error: null, isLoading: false }),
}));

import { ApplicantApplicationStatus } from "./applicant-application-status";

describe("ApplicantApplicationStatus", () => {
  it("shows each application's progress without a separate name details card", () => {
    state.rows = [{ id: "123e4567-e89b-42d3-a456-426614174000", status: "Panel Interview", submitted_at: "2026-09-20T00:00:00Z", job_openings: { title: "Patrolman" } }];
    render(<ApplicantApplicationStatus />);
    const card = screen.getByRole("article", { name: "Patrolman" });
    expect(within(card).getByRole("list", { name: "Application progress" })).toBeInTheDocument();
    expect(within(card).getByText("7 / 8")).toBeVisible();
    expect(within(card).getByText("Submitted September 20, 2026")).toBeVisible();
    expect(within(card).getByRole("link", { name: "View application" })).toHaveAttribute("href", "/applicant/applications/123e4567-e89b-42d3-a456-426614174000");
    expect(screen.queryByRole("region", { name: "Application Details" })).not.toBeInTheDocument();
    expect(screen.queryByText("Last Name")).not.toBeInTheDocument();
  });

  it("points applicants without an application to the job openings", () => {
    state.rows = [];
    render(<ApplicantApplicationStatus />);
    expect(screen.getByText("You have not submitted any applications yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse job openings" })).toHaveAttribute("href", "/jobs");
  });
});
