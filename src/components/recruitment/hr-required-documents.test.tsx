import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ documents: vi.fn(), url: vi.fn() }));
vi.mock("@/hooks/use-recruitment", () => ({ useApplicantProfileDocumentsFor: mocks.documents }));
vi.mock("@/queries/recruitment", () => ({ getApplicantProfileDocumentUrl: mocks.url }));

import { HrRequiredDocuments } from "./hr-required-documents";

const resume = { id: "d1", kind: "resume", file_name: "resume.pdf", object_path: "applicant-profiles/u/r.pdf", updated_at: "2026-10-01T00:00:00Z" };

describe("HrRequiredDocuments", () => {
  it("lists all five required documents and marks missing ones", () => {
    mocks.documents.mockReturnValue({ data: [resume], error: null, isLoading: false });
    render(<HrRequiredDocuments applicantId="a1" />);
    expect(mocks.documents).toHaveBeenCalledWith("a1");
    expect(screen.getByRole("heading", { name: "Required documents" })).toBeVisible();
    for (const label of ["CV / Resume", "PSA birth certificate", "2x2 picture", "Eligibility", "Diploma"]) expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByRole("button", { name: "Open CV / Resume: resume.pdf" })).toBeVisible();
    expect(screen.getAllByText("Not uploaded")).toHaveLength(4);
  });

  it("opens a document through a signed URL", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mocks.url.mockResolvedValue("https://signed.example/r.pdf");
    mocks.documents.mockReturnValue({ data: [resume], error: null, isLoading: false });
    render(<HrRequiredDocuments applicantId="a1" />);
    await user.click(screen.getByRole("button", { name: "Open CV / Resume: resume.pdf" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://signed.example/r.pdf", "_blank", "noopener,noreferrer"));
  });
});
