import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HrApplicationDetail } from "./hr-application-detail";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  saveJob: vi.fn(),
  transition: vi.fn(),
  hire: vi.fn(),
  retry: vi.fn(),
  remark: vi.fn(),
  scores: [] as Array<{ id: string; status: "queued" | "processing" | "completed" | "failed"; score: number | null; explanation: string | null; failure_code?: string | null }>,
  scoreError: null as Error | null,
  applications: [] as Array<Record<string, unknown>>,
  registeredApplicants: [] as Array<Record<string, unknown>>,
  applicationStatus: "Shortlisted",
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));

vi.mock("@/hooks/use-applicant-portal", () => ({
  useHrRegisteredApplicants: () => ({ isLoading: false, error: null, data: mocks.registeredApplicants }),
}));

vi.mock("@/hooks/use-recruitment", () => ({
  useSaveJobOpening: () => ({ isPending: false, mutateAsync: mocks.saveJob }),
  useMyApplication: () => ({
    isLoading: false,
    data: {
      application: { id: "00000000-0000-0000-0000-000000000001", applicant_id: "00000000-0000-0000-0000-0000000000a1", status: mocks.applicationStatus, submitted_at: "2026-08-20T00:00:00Z", cover_note: "Interested", applicants: { applicant_number: 12345 } },
      history: [{ id: "00000000-0000-0000-0000-000000000002", next_status: "Shortlisted", note: null }],
      documents: [],
    },
  }),
  useTransitionApplicationStatus: () => ({ isPending: false, mutateAsync: mocks.transition }),
  useHireApplication: () => ({ isPending: false, mutateAsync: mocks.hire }),
  useApplicationAiScores: () => ({ data: mocks.scores, error: mocks.scoreError }),
  useApplicantProfileDocumentsFor: (applicantId: string) => ({ isLoading: false, error: null, data: applicantId ? [{ id: "d1", kind: "resume", file_name: "resume.pdf", object_path: "applicant-profiles/u/r.pdf", updated_at: "2026-10-01T00:00:00Z" }] : [] }),
  useRetryApplicationAnalysis: () => ({ isPending: false, mutateAsync: mocks.retry }),
  useAddApplicationRemark: () => ({ isPending: false, mutateAsync: mocks.remark }),
  useHrApplications: () => ({ isLoading: false, error: null, data: { rows: mocks.applications } }),
}));

describe("HR recruitment workspace", () => {
  beforeEach(() => {
    mocks.scores = [];
    mocks.scoreError = null;
    mocks.applications = [];
    mocks.registeredApplicants = [];
    mocks.applicationStatus = "Shortlisted";
    mocks.saveJob.mockReset();
    mocks.transition.mockReset();
  });

  it("allows HR to move an application forward and open the hire decision", async () => {
    mocks.transition.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    expect(screen.getByLabelText("Next status")).toHaveValue("");
    await user.selectOptions(screen.getByLabelText("Next status"), "Interview");
    await user.click(screen.getByRole("button", { name: "Update status" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: "00000000-0000-0000-0000-000000000001", nextStatus: "Interview", note: undefined });
    expect(await screen.findByRole("status")).toHaveTextContent("Status updated to Interview.");
    expect(screen.queryByRole("option", { name: "Hired" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hire applicant" })).not.toBeInTheDocument();
  });

  it("opens the hire decision only once the applicant is endorsed for training", async () => {
    mocks.applicationStatus = "For Training";
    const user = userEvent.setup();
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    await user.click(screen.getByRole("button", { name: "Hire applicant" }));
    expect(screen.getByRole("heading", { name: "Hire applicant" })).toBeInTheDocument();
    expect(screen.getByLabelText("Applicant number")).toHaveValue("0-12345");
    expect(screen.getByLabelText(/^badge number/i)).toBeRequired();
    expect(screen.queryByLabelText("Department")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Employment start date")).not.toBeInTheDocument();
  });

  it("shows queued analysis progress without asking HR to paste a CV", () => {
    mocks.scores = [{ id: "00000000-0000-0000-0000-000000000003", status: "queued", score: null, explanation: null }];
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    expect(screen.getByText("Analyzing application…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Approved anonymized CV text")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Analyze application" })).not.toBeInTheDocument();
  });

  it("tells HR when an analysis timed out and still offers a retry", () => {
    mocks.scores = [{ id: "00000000-0000-0000-0000-000000000003", status: "failed", score: null, explanation: null, failure_code: "timed_out" }];

    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByText(/Analysis timed out\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry analysis" })).toBeInTheDocument();
  });

  it("shows AI score loading errors instead of misreporting them as not analyzed", () => {
    mocks.scoreError = new Error("Unable to load recommendations");
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load recommendations");
    expect(screen.queryByText(/This may be an application submitted before/)).not.toBeInTheDocument();
  });

  it.each([
    ["Submitted", ["Under Review"]],
    ["Under Review", ["Shortlisted", "Interview", "Not Selected"]],
    ["Shortlisted", ["Interview", "Not Selected"]],
    ["Interview", ["Endorsed to Crame", "Shortlisted", "Not Selected"]],
    ["Endorsed to Crame", ["Neuro Exam", "Not Selected"]],
    ["Neuro Exam", ["For Training", "Not Selected"]],
    ["For Training", ["Not Selected"]],
  ])("offers only the allowed next statuses, never Needs Revision, from %s", (status, expected) => {
    mocks.applicationStatus = status;
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    const options = within(screen.getByLabelText("Next status")).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Choose next status", ...expected]);
  });

  it("shows the applicant's required documents apart from the files attached to the application", () => {
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("heading", { name: "Required documents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open CV / Resume: resume.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Submitted with this application" })).toBeInTheDocument();
  });

  it("explains when no review transition is available", () => {
    mocks.applicationStatus = "Needs Revision";
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    expect(screen.queryByLabelText("Next status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update status" })).not.toBeInTheDocument();
    expect(screen.getByText("No review status changes are available from Needs Revision.")).toBeInTheDocument();
  });

  it("asks HR to choose a status before submitting and reports failures", async () => {
    mocks.transition.mockRejectedValue(new Error("Invalid application status transition."));
    const user = userEvent.setup();
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    await user.click(screen.getByRole("button", { name: "Update status" }));
    expect(screen.getByText("Choose the next status.")).toBeInTheDocument();
    expect(mocks.transition).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Next status"), "Not Selected");
    await user.type(screen.getByLabelText("Note"), "Vacancy filled");
    await user.click(screen.getByRole("button", { name: "Update status" }));
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "Not Selected", note: "Vacancy filled" }));
    expect(await screen.findByText("Invalid application status transition.")).toBeInTheDocument();
  });

  it("adds a progress remark the applicant is notified of", async () => {
    mocks.remark.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    await user.click(screen.getByRole("button", { name: "Add remark" }));
    expect(screen.getByText("Enter a remark.")).toBeVisible();
    expect(mocks.remark).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Remark"), "Passed the BMI at Crame.");
    await user.click(screen.getByRole("button", { name: "Add remark" }));

    expect(mocks.remark).toHaveBeenCalledWith({ applicationId: "00000000-0000-0000-0000-000000000001", remark: "Passed the BMI at Crame." });
    expect(await screen.findByText("Remark added. The applicant was notified.")).toBeVisible();
  });

  it("tells HR the neuro exam waits for the applicant's BMI proof", () => {
    mocks.applicationStatus = "Endorsed to Crame";
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    expect(screen.getByRole("note")).toHaveTextContent("Waiting for the applicant to upload proof of passing the BMI.");
  });
});
