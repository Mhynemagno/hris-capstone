import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "Application Submission" }));

const application = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  status: "Application Submission",
  submitted_at: "2026-09-07T00:00:00.000Z",
  job_openings: {
    id: 4, title: "Investigator", description: "Handles case files for the station.", location: null, closes_on: null, status: "closed",
    departments: { name: "Intelligence Section" }, ranks: { name: "Police Corporal", code: "PCpl" }, job_qualification_criteria: [],
  },
};

vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplication: () => ({
    data: { application: { ...application, status: state.status }, history: [{ id: "h1", next_status: "Application Submission", note: "Your application is now under review.", created_at: "2026-09-08T00:00:00.000Z" }],
      documents: [{ id: "d1", kind: "cv", file_name: "cv.pdf", object_path: "applicants/a/b/cv.pdf" }] },
    error: null,
    isLoading: false,
  }),
}));
vi.mock("@/queries/recruitment", () => ({ getApplicantDocumentUrl: vi.fn().mockResolvedValue(null) }));

import { ApplicantApplicationDetail } from "./applicant-application-detail";

describe("ApplicantApplicationDetail", () => {
  beforeEach(() => {
    state.status = "Application Submission";
  });

  it("shows submitted documents with a semantic submitted badge", () => {
    render(<ApplicantApplicationDetail applicationId={application.id} />);

    expect(screen.getByRole("heading", { name: "What you applied for" })).toBeInTheDocument();
    expect(screen.getByText("Investigator")).toBeInTheDocument();
    expect(screen.getByText("PCpl — Police Corporal")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Status history" })).toHaveTextContent("September 8, 2026");
    expect(screen.getByRole("list", { name: "Documents" })).toHaveTextContent("CV");
    expect(screen.getByText("SUBMITTED")).toHaveClass("text-emerald-800");
    expect(screen.queryByRole("button", { name: "Resubmit application" })).not.toBeInTheDocument();
  });
});
