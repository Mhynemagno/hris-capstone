import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as unknown[], history: [] as unknown[], documents: [] as unknown[] }));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyApplicationStatuses: () => ({ data: { rows: state.rows }, error: null, isLoading: false }),
  useMyApplicationHistory: () => ({ data: state.history, error: null, isLoading: false }),
}));
vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfile: () => ({ data: { first_name: "Aldrick" }, error: null, isLoading: false }),
  useApplicantProfileDocuments: () => ({ data: state.documents, error: null, isLoading: false }),
}));

import { ApplicantDashboard } from "./applicant-dashboard";

const fiveDocuments = ["resume", "psa", "photo", "eligibility", "diploma"].map((kind) => ({ kind }));

describe("ApplicantDashboard", () => {
  beforeEach(() => {
    state.rows = [];
    state.history = [];
    state.documents = [{ kind: "resume" }, { kind: "psa" }, { kind: "photo" }];
  });

  it("guides a new applicant to upload documents", () => {
    render(<ApplicantDashboard />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Aldrick!" })).toBeVisible();
    expect(screen.getByText(/Monitor your application progress and manage your documentary requirements for CY \d{4} Recruitment\./)).toBeVisible();
    const latest = screen.getByRole("region", { name: "Latest application" });
    expect(latest).toHaveTextContent("Pending");
    expect(latest).toHaveTextContent("0 / 8");
    const documents = screen.getByRole("region", { name: "Documents" });
    expect(documents).toHaveTextContent("3 of 5");
    expect(within(documents).getByRole("link", { name: /Manage documents/ })).toHaveAttribute("href", "/applicant/documents");
    const next = screen.getByRole("region", { name: "Next Action Required" });
    expect(next).toHaveTextContent("Upload your required documents");
    expect(within(next).getByRole("link", { name: /View Schedule Details/ })).toHaveAttribute("href", "/applicant/documents");
    const process = screen.getByRole("region", { name: "Recruitment process" });
    expect(within(process).getAllByRole("listitem")).toHaveLength(8);
    expect(process).toHaveTextContent("Background Investigation");
    expect(screen.queryByText(/Job openings/)).not.toBeInTheDocument();
    expect(screen.queryByText(/minimum qualifications/i)).not.toBeInTheDocument();
  });

  it("shows the latest application's stage, progress and schedule", () => {
    state.documents = fiveDocuments;
    state.rows = [{ id: "a1", status: "Physical Agility Test", stage_result: "scheduled", stage_scheduled_at: "2026-10-17T22:00:00Z", stage_venue: "Grandstand Sports Complex", submitted_at: "2026-10-09T02:00:00Z", job_openings: { title: "San Juan City Recruitment" } }];
    state.history = [{ previous_status: "Application Submission", next_status: "Physical Agility Test", created_at: "2026-10-10T02:00:00Z" }];
    render(<ApplicantDashboard />);
    const latest = screen.getByRole("region", { name: "Latest application" });
    expect(latest).toHaveTextContent("SAN JUAN CITY RECRUITMENT - CY 2026");
    expect(latest).toHaveTextContent("Physical Agility Test");
    expect(latest).toHaveTextContent("2 / 8");
    expect(within(latest).getByRole("link", { name: /View application status/ })).toHaveAttribute("href", "/applicant/applications");
    expect(screen.getByRole("region", { name: "Documents" })).toHaveTextContent("Required documents uploaded and verified.");
    expect(screen.getByRole("region", { name: "Next Action Required" })).toHaveTextContent("Physical Agility Test AttendanceScheduled on October 18, 2026 (6:00 AM) at Grandstand Sports Complex.");
    const progress = screen.getByRole("region", { name: "Latest application progress" });
    expect(progress).toHaveTextContent("Completed & Verified on October 10, 2026.");
  });
});
