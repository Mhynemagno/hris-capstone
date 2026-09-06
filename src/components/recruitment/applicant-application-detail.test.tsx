import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const application = {
  id: "223e4567-e89b-42d3-a456-426614174000",
  status: "Needs Revision",
  submitted_at: "2026-09-07T00:00:00.000Z",
};

vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplication: () => ({
    data: { application, history: [{ id: "h1", next_status: "Needs Revision", note: "Please upload a clearer CV." }], documents: [] },
    error: null,
    isLoading: false,
  }),
  useResubmitApplication: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/queries/recruitment", () => ({ getApplicantDocumentUrl: vi.fn() }));

import { ApplicantApplicationDetail } from "./applicant-application-detail";

describe("ApplicantApplicationDetail", () => {
  it("offers document re-upload only while HR has marked the application Needs Revision", async () => {
    render(<ApplicantApplicationDetail applicationId={application.id} />);

    expect(screen.getByRole("heading", { name: /Needs Revision/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Replacement CV (PDF)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resubmit application" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("listitem")).toHaveTextContent("Please upload a clearer CV."));
  });
});
