import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  submit: vi.fn(),
  setPreferred: vi.fn(),
  notify: vi.fn(),
  replace: vi.fn(),
  documents: [] as unknown[],
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/hooks/use-recruitment", () => ({
  useApplicantProfileDocuments: () => ({ data: mocks.documents, error: null, isLoading: false }),
  useSaveApplicantProfileDocuments: () => ({ isPending: false, mutateAsync: mocks.save }),
  useSubmitMyApplication: () => ({ isPending: false, mutateAsync: mocks.submit }),
}));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useRemoveMyApplicantProfileDocument: () => ({ isPending: false, mutateAsync: mocks.remove }),
}));
vi.mock("@/queries/recruitment", () => ({
  getApplicantProfileDocumentUrl: vi.fn().mockResolvedValue("https://signed.example/doc"),
  setMyPreferredJobOpening: mocks.setPreferred,
}));
vi.mock("@/components/app-shell/applicant-toaster", () => ({ notifyApplicant: mocks.notify }));

import { ApplicantProfileDocuments } from "./applicant-profile-documents";

const saved = (kind: string, file_name: string, mime_type = "application/pdf") => ({ id: `d-${kind}`, kind, file_name, mime_type, size_bytes: 1_258_291, object_path: `applicant-profiles/x/${kind}.pdf`, updated_at: "2026-10-11T00:00:00Z" });
const allFive = [saved("resume", "CV_Resume.pdf"), saved("psa", "PSA.pdf"), saved("photo", "2x2.jpg", "image/jpeg"), saved("eligibility", "NAPOLCOM.pdf"), saved("diploma", "Diploma_TOR.pdf")];
const SAVE_ALL = "Save All Documents";

describe("ApplicantProfileDocuments", { timeout: 20_000 }, () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => { if (typeof mock === "function") mock.mockReset(); });
    mocks.documents = [saved("resume", "CV_Resume_Jamlani.pdf"), saved("psa", "PSA.pdf"), saved("photo", "2x2.jpg", "image/jpeg")];
    mocks.save.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
    mocks.setPreferred.mockResolvedValue(undefined);
  });

  it("shows the requirements header, the status and a card for each document", () => {
    render(<ApplicantProfileDocuments />);
    expect(screen.getByRole("heading", { level: 1, name: "Required Documents" })).toBeVisible();
    expect(screen.getByText("Requirements Verification")).toBeVisible();
    expect(screen.getByText("Upload all required documents (up to 10 MB each). The 2×2 picture must be PNG or JPEG; all other documents must be PDF files.")).toBeVisible();
    expect(screen.getByText("3 of 5")).toBeVisible();
    for (const label of ["CV / Resume", "PSA Birth Certificate", "2×2 ID Picture", "Eligibility Certificate", "College Diploma & TOR"]) {
      expect(screen.getByRole("region", { name: label })).toBeInTheDocument();
    }
    const cv = screen.getByRole("region", { name: "CV / Resume" });
    expect(cv).toHaveTextContent("Saved");
    expect(cv).toHaveTextContent("Format: PDF only (Max 10 MB)");
    expect(cv).toHaveTextContent("CV_Resume_Jamlani.pdf");
    expect(cv).toHaveTextContent("Saved October 11, 2026 • 1.2 MB");
    expect(within(cv).getByRole("button", { name: "View CV / Resume" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "2×2 ID Picture" })).toHaveTextContent("Format: PNG or JPEG only");
    expect(screen.getByRole("region", { name: "Eligibility Certificate" })).toHaveTextContent("Format: PDF only (NAPOLCOM / CSC)");
    expect(within(screen.getByRole("region", { name: "Eligibility Certificate" })).getByRole("button", { name: "Delete Eligibility Certificate" })).toBeDisabled();
  });

  it("accepts only PNG or JPEG images for the 2×2 picture and PDFs for the rest", () => {
    render(<ApplicantProfileDocuments />);
    expect(screen.getByLabelText("Upload 2×2 ID Picture")).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(screen.getByLabelText("Upload PSA Birth Certificate")).toHaveAttribute("accept", "application/pdf");
  });

  it("uploads a chosen file straight away and confirms it", async () => {
    render(<ApplicantProfileDocuments />);
    await userEvent.upload(screen.getByLabelText("Upload Eligibility Certificate"), new File(["%PDF"], "napolcom.pdf", { type: "application/pdf" }));
    expect(mocks.save).toHaveBeenCalledWith({ eligibility: expect.any(File) });
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "Saved Successfully!", description: "Your document status has been updated." }));
  });

  it("refuses a wrong format with an error notice and uploads nothing", async () => {
    render(<ApplicantProfileDocuments />);
    await userEvent.upload(screen.getByLabelText("Upload Eligibility Certificate"), new File(["x"], "photo.png", { type: "image/png" }), { applyAccept: false });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ title: "Document not saved", tone: "error" }));
  });

  it("asks before deleting and confirms the deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: "Delete CV / Resume" }));
    expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to delete your uploaded CV / Resume?");
    expect(mocks.remove).toHaveBeenCalledWith("resume");
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "Document Deleted", description: "CV / Resume has been removed." }));
  });

  it("keeps the document when the applicant cancels", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: "Delete CV / Resume" }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("shows the server's reason when a document cannot be deleted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.remove.mockRejectedValue(new Error("Upload a replacement instead."));
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: "Delete CV / Resume" }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "Document not deleted", description: "Upload a replacement instead.", tone: "error" }));
  });

  it("asks for the missing documents on Save", async () => {
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: SAVE_ALL }));
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Please upload required documents", description: "Still needed: Eligibility Certificate, College Diploma & TOR.", tone: "warning" });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("submits the application on Save once all five are on file", async () => {
    mocks.documents = allFive;
    mocks.submit.mockResolvedValue({ outcome: "submitted", applicationId: "a1" });
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: SAVE_ALL }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "All Documents Saved!", description: "Your files have been saved to your portal." }));
  });

  it("does not submit again when an application is active", async () => {
    mocks.documents = allFive;
    mocks.submit.mockResolvedValue({ outcome: "already-active" });
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: SAVE_ALL }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "All Documents Saved!", description: "Your files have been saved to your portal." }));
    expect(screen.getByRole("button", { name: SAVE_ALL })).toBeEnabled();
  });

  it("explains when there is no open recruitment", async () => {
    mocks.documents = allFive;
    mocks.submit.mockResolvedValue({ outcome: "no-open-posting" });
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: SAVE_ALL }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "All Documents Saved!", description: "Your documents are saved. There is no open recruitment right now.", tone: "warning" }));
  });

  it("explains a failed submission", async () => {
    mocks.documents = allFive;
    mocks.submit.mockRejectedValue(new Error("The selected job opening is not accepting applications."));
    render(<ApplicantProfileDocuments />);
    await userEvent.click(screen.getByRole("button", { name: SAVE_ALL }));
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ title: "Application not submitted", description: "The selected job opening is not accepting applications.", tone: "error" }));
  });

  it("remembers the posting the applicant clicked Apply on, once", async () => {
    const { rerender } = render(<ApplicantProfileDocuments applyJobId={12} />);
    await waitFor(() => expect(mocks.setPreferred).toHaveBeenCalledWith(12));
    rerender(<ApplicantProfileDocuments applyJobId={12} />);
    expect(mocks.setPreferred).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/applicant/documents"));
  });
});
