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

  it("lists every required document with uploaded and missing states", () => {
    mocks.documents = [{ id: "d1", kind: "diploma", file_name: "diploma.pdf", object_path: "applicant-profiles/x/y.pdf", updated_at: "2026-09-01T00:00:00Z" }];
    render(<ApplicantProfileDocuments />);
    for (const label of ["CV / Resume", "PSA birth certificate", "2x2 picture", "Eligibility", "Diploma"]) {
      expect(screen.getByLabelText(`Upload ${label} document`)).toBeInTheDocument();
    }
    expect(screen.getByText("diploma.pdf")).toBeVisible();
    expect(screen.getByText("Uploaded September 1, 2026")).toBeVisible();
    expect(screen.getAllByText("Not uploaded")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Remove Diploma document" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Remove Eligibility document" })).not.toBeInTheDocument();
  });

  it("accepts only PNG or JPEG images for the 2x2 picture", () => {
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    expect(screen.getByLabelText("Upload 2x2 picture document")).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(screen.getByLabelText("Upload PSA birth certificate document")).toHaveAttribute("accept", "application/pdf,image/png,image/jpeg");
  });

  it("rejects a PDF for the 2x2 picture before uploading", async () => {
    const user = userEvent.setup({ applyAccept: false });
    mocks.documents = [];
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload 2x2 picture document"), new File(["pdf"], "photo.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a PNG or JPEG image for the 2x2 picture.");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("uploads a document for a kind", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    mocks.save.mockResolvedValue(undefined);
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload Eligibility document"), new File(["pdf"], "eligibility.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith([expect.objectContaining({ kind: "eligibility" })]));
    expect(await screen.findByRole("status")).toHaveTextContent("Eligibility document saved.");

    await user.upload(screen.getByLabelText("Upload 2x2 picture document"), new File(["png"], "photo.png", { type: "image/png" }));
    await waitFor(() => expect(mocks.save).toHaveBeenLastCalledWith([expect.objectContaining({ kind: "photo" })]));
    expect(await screen.findByRole("status")).toHaveTextContent("2x2 picture document saved.");
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
