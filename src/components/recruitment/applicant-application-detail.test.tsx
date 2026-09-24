import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const application = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  status: "Needs Revision",
  submitted_at: "2026-09-07T00:00:00.000Z",
  job_openings: {
    id: 4, title: "Investigator", description: "Handles case files for the station.", location: null, closes_on: null, status: "closed",
    departments: { name: "Intelligence Section" }, ranks: { name: "Police Corporal", code: "PCpl" }, job_qualification_criteria: [],
  },
};

vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplication: () => ({
    data: { application, history: [{ id: "h1", next_status: "Needs Revision", note: "Please upload a clearer CV.", created_at: "2026-09-08T00:00:00.000Z" }],
      documents: [{ id: "d1", kind: "cv", file_name: "cv.pdf", object_path: "applicants/a/b/cv.pdf" }] },
    error: null,
    isLoading: false,
  }),
  useResubmitApplication: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/queries/recruitment", () => ({ getApplicantDocumentUrl: vi.fn().mockResolvedValue(null) }));

import { ApplicantApplicationDetail } from "./applicant-application-detail";

describe("ApplicantApplicationDetail", () => {
  it("offers document re-upload only while HR has marked the application Needs Revision", async () => {
    render(<ApplicantApplicationDetail applicationId={application.id} />);

    expect(screen.getByRole("heading", { name: /Needs Revision/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Replacement CV (PDF)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resubmit application" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("list", { name: "Status history" })).toHaveTextContent("Please upload a clearer CV."));
  });

  it("shows what the applicant applied for, dated status history, and document types", () => {
    render(<ApplicantApplicationDetail applicationId={application.id} />);

    expect(screen.getByRole("heading", { name: "What you applied for" })).toBeInTheDocument();
    expect(screen.getByText("Investigator")).toBeInTheDocument();
    expect(screen.getByText("PCpl — Police Corporal")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Status history" })).toHaveTextContent(new Date("2026-09-08T00:00:00.000Z").toLocaleDateString());
    expect(screen.getByRole("list", { name: "Documents" })).toHaveTextContent("CV");
  });
});
