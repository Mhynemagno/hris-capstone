import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as unknown[], history: [] as unknown[] }));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyApplicationStatuses: () => ({ data: { rows: state.rows }, error: null, isLoading: false }),
  useMyApplicationHistory: () => ({ data: state.history, error: null, isLoading: false }),
}));

import { ApplicantStatusCard } from "./applicant-status-card";

const application = (status: string, extra: Record<string, unknown> = {}) => ({ id: "a1", status, stage_result: "pending", stage_scheduled_at: null, stage_venue: null, ...extra });

describe("ApplicantStatusCard", () => {
  beforeEach(() => {
    state.rows = [];
    state.history = [];
  });

  it("shows the next action, its schedule and HR's remarks for the current stage", () => {
    state.rows = [application("Physical Agility Test", { stage_result: "scheduled", stage_scheduled_at: "2026-10-17T22:00:00Z", stage_venue: "San Juan Grandstand Sports Complex" })];
    state.history = [
      { previous_status: "Application Submission", next_status: "Application Submission", note: "Documents complete.", result: "verified", created_at: "2026-10-09T00:00:00Z" },
      { previous_status: "Physical Agility Test", next_status: "Physical Agility Test", note: "Proper Attire: White Plain T-Shirt, Navy Blue Shorts, Running Shoes.", result: null, created_at: "2026-10-11T00:00:00Z" },
      { previous_status: "Physical Agility Test", next_status: "Physical Agility Test", note: "Bring 2 hard copies of your Applicant Admission Slip.", result: "scheduled", created_at: "2026-10-11T01:00:00Z" },
      { previous_status: "Physical Agility Test", next_status: "Physical Agility Test", note: null, result: null, created_at: "2026-10-11T02:00:00Z" },
    ];
    render(<ApplicantStatusCard />);
    expect(screen.getByRole("heading", { level: 1, name: "Application Status" })).toBeInTheDocument();
    expect(screen.getByText("Next Action Required: Physical Agility Test")).toBeInTheDocument();
    expect(screen.getByText("Reporting time: 6:00 AM on October 18, 2026 at San Juan Grandstand Sports Complex.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "REMARKS" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Proper Attire: White Plain T-Shirt, Navy Blue Shorts, Running Shoes.",
      "Bring 2 hard copies of your Applicant Admission Slip.",
    ]);
  });

  it("explains the pending state before an application exists", () => {
    render(<ApplicantStatusCard />);
    expect(screen.getByText("Your application is pending. Upload all required documents and press Save All Documents to submit it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Documents" })).toHaveAttribute("href", "/applicant/documents");
  });

  it("shows the stage message when nothing is scheduled", () => {
    state.rows = [application("Drug Test")];
    render(<ApplicantStatusCard />);
    expect(screen.getByText("Next Action Required: Drug Test")).toBeInTheDocument();
    expect(screen.getByText("You are now scheduled for the drug test.")).toBeInTheDocument();
    expect(screen.getByText("No remarks from HR yet.")).toBeInTheDocument();
  });

  it("shows the final result", () => {
    state.rows = [application("Not Selected")];
    render(<ApplicantStatusCard />);
    expect(screen.getByText("Thank you for applying. You were not selected for this opening.")).toBeInTheDocument();
    expect(screen.queryByText(/Next Action Required/)).not.toBeInTheDocument();
  });

  it("shows the note HR sent with the result that moved the application to its current status", () => {
    state.rows = [application("Not Selected")];
    state.history = [
      { previous_status: "Drug Test", next_status: "Not Selected", note: "Did not meet the BMI requirement.", result: "failed", created_at: "2026-10-12T00:00:00Z" },
    ];
    render(<ApplicantStatusCard />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Did not meet the BMI requirement."]);
  });
});
