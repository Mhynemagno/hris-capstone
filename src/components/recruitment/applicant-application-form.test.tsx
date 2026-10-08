import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), existingApplication: vi.fn(), documents: vi.fn(), loadFile: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplicationForJob: mocks.existingApplication,
  useSubmitApplication: () => ({ isPending: false, mutateAsync: mocks.submit }),
  useApplicantProfileDocuments: mocks.documents,
}));
vi.mock("@/queries/recruitment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/queries/recruitment")>()),
  loadMyProfileDocumentFile: mocks.loadFile,
}));

import { ApplicantProfileRequiredError } from "@/queries/recruitment";
import { ApplicantApplicationForm } from "./applicant-application-form";

const saved = (kind: string) => ({ id: kind, kind, object_path: `applicant-profiles/u/${kind}.pdf`, file_name: `${kind}.pdf`, mime_type: "application/pdf", updated_at: "2026-10-01T00:00:00Z" });
const allFive = ["resume", "psa", "photo", "eligibility", "diploma"].map(saved);

describe("ApplicantApplicationForm", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.loadFile.mockReset();
    mocks.existingApplication.mockReturnValue({ data: null, error: null, isLoading: false });
    mocks.documents.mockReturnValue({ data: allFive, error: null, isLoading: false });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has no CV upload; the saved CV is used", () => {
    render(<ApplicantApplicationForm jobId={7} />);
    expect(screen.queryByLabelText("CV (PDF)")).not.toBeInTheDocument();
    expect(screen.getByText("Your saved CV / Resume and required documents are included.")).toBeVisible();
  });

  it("disables Submit until all five required documents are saved", () => {
    mocks.documents.mockReturnValue({ data: allFive.slice(0, 4), error: null, isLoading: false });
    render(<ApplicantApplicationForm jobId={7} />);
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
    expect(screen.getByText("Save all 5 required documents to submit.")).toBeVisible();
  });

  it("blocks Submit while a chosen replacement document is not saved yet", () => {
    render(<ApplicantApplicationForm hasUnsavedDocuments jobId={7} />);
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
    expect(screen.getByText("Save or cancel the file you chose above before submitting.")).toBeVisible();
  });

  it("attaches only the saved CV and shows a tracking link", async () => {
    const user = userEvent.setup();
    const cv = new File(["CV"], "resume.pdf", { type: "application/pdf" });
    mocks.loadFile.mockResolvedValue(cv);
    mocks.submit.mockResolvedValue("223e4567-e89b-42d3-a456-426614174000");
    render(<ApplicantApplicationForm jobId={7} />);
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(mocks.loadFile).toHaveBeenCalledWith(expect.objectContaining({ object_path: "applicant-profiles/u/resume.pdf" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 7,
      documents: [{ kind: "cv", file: cv }],
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Application submitted");
    expect(screen.getByRole("link", { name: "Track application" })).toHaveAttribute("href", "/applicant/applications/223e4567-e89b-42d3-a456-426614174000");
  });

  it("shows the CV attach failure and does not submit", async () => {
    const user = userEvent.setup();
    mocks.loadFile.mockRejectedValue(new Error("We could not attach your saved CV. Try again."));
    render(<ApplicantApplicationForm jobId={7} />);
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not attach your saved CV. Try again.");
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("links legacy applicants to complete their profile before retrying", async () => {
    const user = userEvent.setup();
    mocks.loadFile.mockResolvedValue(new File(["CV"], "resume.pdf", { type: "application/pdf" }));
    mocks.submit.mockRejectedValue(new ApplicantProfileRequiredError());
    render(<ApplicantApplicationForm jobId={7} />);
    await user.click(screen.getByRole("button", { name: "Submit application" }));
    expect(await screen.findByRole("link", { name: "Complete profile" })).toHaveAttribute("href", "/applicant/profile");
  });

  it("links to the existing application instead of offering a duplicate submission", () => {
    mocks.existingApplication.mockReturnValue({ data: { id: "223e4567-e89b-42d3-a456-426614174000", status: "Application Submission" }, error: null, isLoading: false });
    render(<ApplicantApplicationForm jobId={7} />);
    expect(screen.getByRole("link", { name: "Open existing application" })).toHaveAttribute("href", "/applicant/applications/223e4567-e89b-42d3-a456-426614174000");
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();
  });
});
