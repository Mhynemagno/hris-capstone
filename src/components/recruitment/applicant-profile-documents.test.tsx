import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), documents: [] as unknown[] }));

vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfileDocuments: () => ({ data: mocks.documents, error: null, isLoading: false }),
  useSaveApplicantProfileDocuments: () => ({ isPending: false, mutateAsync: mocks.save }),
}));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useRemoveMyApplicantProfileDocument: () => ({ isPending: false, mutateAsync: mocks.remove }),
}));
vi.mock("@/queries/recruitment", () => ({ getApplicantProfileDocumentUrl: vi.fn().mockResolvedValue("https://signed.example/doc") }));

import { ApplicantProfileDocuments } from "./applicant-profile-documents";

describe("ApplicantProfileDocuments", { timeout: 20_000 }, () => {
  afterEach(() => { vi.restoreAllMocks(); mocks.save.mockReset(); mocks.remove.mockReset(); });

  it("lists every required document, its saved state, and a progress summary", () => {
    mocks.documents = [{ id: "d1", kind: "diploma", file_name: "diploma.pdf", object_path: "applicant-profiles/x/y.pdf", updated_at: "2026-09-01T00:00:00Z" }];
    render(<ApplicantProfileDocuments />);
    for (const label of ["CV / Resume", "PSA birth certificate", "2x2 picture", "Eligibility", "Diploma"]) {
      expect(screen.getByLabelText(`Upload ${label} document`)).toBeInTheDocument();
    }
    expect(screen.getByText("1 of 5 required documents saved")).toBeVisible();
    expect(screen.getByText("Still needed: CV / Resume, PSA birth certificate, 2x2 picture, Eligibility")).toBeVisible();
    expect(screen.getByText("diploma.pdf")).toBeVisible();
    expect(screen.getByText("Saved September 1, 2026")).toBeVisible();
    expect(screen.getAllByText("Not saved yet")).toHaveLength(4);
  });

  it("accepts only PNG or JPEG images for the 2x2 picture and PDFs for the rest", () => {
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    expect(screen.getByLabelText("Upload 2x2 picture document")).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(screen.getByLabelText("Upload PSA birth certificate document")).toHaveAttribute("accept", "application/pdf");
  });

  it("does not upload on pick and saves all staged files only from the final Save documents action", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    mocks.save.mockResolvedValue(undefined);
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload Eligibility document"), new File(["pdf"], "eligibility.pdf", { type: "application/pdf" }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText(/Selected: eligibility\.pdf/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Eligibility document" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save documents" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ eligibility: expect.any(File) })));
    expect(await screen.findByRole("status")).toHaveTextContent("Documents saved.");
    expect(screen.queryByRole("button", { name: "Save documents" })).not.toBeInTheDocument();
  });

  it("shows a wrong format under the card and never offers Save for it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload CV / Resume document"), new File(["png"], "cv.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload the CV / Resume as a PDF file.");
    expect(screen.queryByRole("button", { name: "Save CV / Resume document" })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("cancels a pending pick", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload Diploma document"), new File(["pdf"], "diploma.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Cancel Diploma upload" }));
    expect(screen.queryByText(/Selected: diploma\.pdf/)).not.toBeInTheDocument();
  });

  it("tells its parent whether a chosen file is still unsaved", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    mocks.documents = [];
    render(<ApplicantProfileDocuments onPendingChange={onPendingChange} />);
    await user.upload(screen.getByLabelText("Upload Diploma document"), new File(["pdf"], "diploma.pdf", { type: "application/pdf" }));
    expect(onPendingChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Cancel Diploma upload" }));
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
  });

  it("warns before leaving with an unsaved pick", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload Diploma document"), new File(["pdf"], "diploma.pdf", { type: "application/pdf" }));
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("removes a document after confirmation and shows database refusals", async () => {
    const user = userEvent.setup();
    mocks.documents = [{ id: "d1", kind: "eligibility", file_name: "eligibility.pdf", object_path: "applicant-profiles/x/y.pdf", updated_at: "2026-09-01T00:00:00Z" }];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.remove.mockResolvedValueOnce({ cleanupError: null }).mockRejectedValueOnce(new Error("This document is under review for an application in progress. Upload a replacement instead of removing it."));
    render(<ApplicantProfileDocuments />);
    await user.click(screen.getByRole("button", { name: "Remove Eligibility document" }));
    expect(mocks.remove).toHaveBeenCalledWith("eligibility");
    expect(await screen.findByRole("status")).toHaveTextContent("Eligibility document removed.");
    await user.click(screen.getByRole("button", { name: "Remove Eligibility document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("under review");
  });
});
