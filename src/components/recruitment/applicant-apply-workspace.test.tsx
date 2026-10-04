import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ job: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({ usePublishedJob: mocks.job }));
vi.mock("./applicant-profile-documents", () => ({ ApplicantProfileDocuments: () => <section>documents-section</section> }));
vi.mock("./applicant-application-form", () => ({ ApplicantApplicationForm: ({ jobId }: { jobId: number }) => <form>form-for-{jobId}</form> }));

import { ApplicantApplyWorkspace } from "./applicant-apply-workspace";

describe("ApplicantApplyWorkspace", () => {
  it("shows the job, then the required documents, then the application form", () => {
    mocks.job.mockReturnValue({ data: { id: 7, title: "Patrolman", location: "San Juan City", closes_on: "2026-12-01" }, error: null, isLoading: false });
    const { container } = render(<ApplicantApplyWorkspace jobId={7} />);
    expect(screen.getByRole("heading", { name: "Patrolman" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View job details" })).toHaveAttribute("href", "/jobs/7");
    expect(container.textContent).toMatch(/Patrolman[\s\S]*documents-section[\s\S]*form-for-7/);
  });

  it("does not offer the form for a closed or unpublished job", () => {
    mocks.job.mockReturnValue({ data: null, error: null, isLoading: false });
    render(<ApplicantApplyWorkspace jobId={7} />);
    expect(screen.getByText("This job opening is unavailable or has closed.")).toBeVisible();
    expect(screen.queryByText("form-for-7")).not.toBeInTheDocument();
  });
});
