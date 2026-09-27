import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-applicant-portal", () => ({
  useMyApplicationStatuses: () => ({ data: { rows: [{ id: "x", status: "Under Review", job_openings: { title: "Patrolman" } }] }, error: null, isLoading: false }),
}));
vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfile: () => ({ data: { first_name: "Juan" }, error: null, isLoading: false }),
  useApplicantProfileDocuments: () => ({ data: [{ kind: "eligibility" }], error: null, isLoading: false }),
}));

import { ApplicantDashboard } from "./applicant-dashboard";

describe("ApplicantDashboard", () => {
  it("summarizes the latest application and required documents", () => {
    render(<ApplicantDashboard />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Juan" })).toBeVisible();
    expect(screen.getByText("Under Review")).toBeVisible();
    expect(screen.getByText("1 of 2")).toBeVisible();
    expect(screen.getByRole("link", { name: "View application status" })).toHaveAttribute("href", "/applicant/applications");
    expect(screen.getByRole("link", { name: "Manage documents" })).toHaveAttribute("href", "/applicant/documents");
    expect(screen.getByRole("link", { name: "Browse job openings" })).toHaveAttribute("href", "/jobs");
  });
});
