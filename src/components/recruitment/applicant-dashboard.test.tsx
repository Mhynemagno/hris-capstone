import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const applications = vi.hoisted(() => ({ rows: [{ id: "x", status: "Panel Interview", job_openings: { title: "Patrolman" } }] as unknown[] }));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyApplicationStatuses: () => ({ data: { rows: applications.rows }, error: null, isLoading: false }),
}));
vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfile: () => ({ data: { first_name: "Juan" }, error: null, isLoading: false }),
  useApplicantProfileDocuments: () => ({ data: [{ kind: "eligibility" }, { kind: "photo" }], error: null, isLoading: false }),
}));

import { ApplicantDashboard } from "./applicant-dashboard";

describe("ApplicantDashboard", () => {
  it("shows the PDF recruitment process, progress, and the latest application's tracker", () => {
    render(<ApplicantDashboard />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Juan" })).toBeVisible();
    expect(screen.getAllByText("Panel Interview").length).toBeGreaterThan(0);
    expect(screen.getByText("7 / 8")).toBeVisible();
    expect(screen.getByRole("list", { name: "Application progress" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Recruitment process" })).toBeVisible();
    expect(screen.getAllByText("Character & Background Investigation").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "PNP minimum qualifications" })).toBeVisible();
    expect(screen.getByText("Baccalaureate Degree")).toBeVisible();
    expect(screen.getByText("2 of 5")).toBeVisible();
    expect(screen.getByText("Upload your CV / Resume, PSA birth certificate, 2x2 picture, Eligibility, and Diploma.")).toBeVisible();
    expect(screen.getByRole("link", { name: "View application status" })).toHaveAttribute("href", "/applicant/applications");
    expect(screen.getByRole("link", { name: "Manage documents" })).toHaveAttribute("href", "/applicant/documents");
    expect(screen.getByRole("link", { name: "Browse job openings" })).toHaveAttribute("href", "/jobs");
  });

  it("points a new applicant to job openings from the latest-application card", () => {
    applications.rows = [];
    render(<ApplicantDashboard />);
    expect(screen.getByRole("link", { name: "Start an application" })).toHaveAttribute("href", "/jobs");
    expect(screen.queryByRole("link", { name: "View application status" })).not.toBeInTheDocument();
    expect(screen.getByText("0 / 8")).toBeVisible();
  });
});
