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

  it("lists uploaded and missing required documents", () => {
    mocks.documents = [{ id: "d1", kind: "diploma", file_name: "diploma.pdf", object_path: "applicant-profiles/x/y.pdf", updated_at: "2026-09-01T00:00:00Z" }];
    render(<ApplicantProfileDocuments />);
    expect(screen.getByText("diploma.pdf")).toBeVisible();
    expect(screen.getByText("Not uploaded")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove diploma document" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Remove eligibility document" })).not.toBeInTheDocument();
  });

  it("uploads a document for a kind", async () => {
    const user = userEvent.setup();
    mocks.documents = [];
    mocks.save.mockResolvedValue(undefined);
    render(<ApplicantProfileDocuments />);
    await user.upload(screen.getByLabelText("Upload eligibility document"), new File(["pdf"], "eligibility.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith([expect.objectContaining({ kind: "eligibility" })]));
    expect(await screen.findByRole("status")).toHaveTextContent("Eligibility document saved.");
  });

  it("removes a document after confirmation and shows database refusals", async () => {
    const user = userEvent.setup();
    mocks.documents = [{ id: "d1", kind: "eligibility", file_name: "eligibility.pdf", object_path: "applicant-profiles/x/y.pdf", updated_at: "2026-09-01T00:00:00Z" }];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.remove.mockResolvedValueOnce({ cleanupError: null }).mockRejectedValueOnce(new Error("This document is under review for an application in progress. Upload a replacement instead of removing it."));
    render(<ApplicantProfileDocuments />);
    await user.click(screen.getByRole("button", { name: "Remove eligibility document" }));
    expect(mocks.remove).toHaveBeenCalledWith("eligibility");
    expect(await screen.findByRole("status")).toHaveTextContent("Eligibility document removed.");
    await user.click(screen.getByRole("button", { name: "Remove eligibility document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("under review");
  });
});
