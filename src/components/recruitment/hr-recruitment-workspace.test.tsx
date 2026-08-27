import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HrJobForm } from "./hr-job-form";
import { HrApplicationDetail } from "./hr-application-detail";
import { HrApplicationList } from "./hr-application-list";

const mocks = vi.hoisted(() => ({
  saveJob: vi.fn(),
  transition: vi.fn(),
  hire: vi.fn(),
  retry: vi.fn(),
  scores: [] as Array<{ id: string; status: "queued" | "processing" | "completed" | "failed"; score: number | null; explanation: string | null; failure_code?: string | null }>,
  scoreError: null as Error | null,
  applications: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/hooks/use-administration", () => ({
  useDepartments: () => ({ data: { rows: [{ id: 1, name: "People" }] } }),
  usePositions: () => ({ data: { rows: [{ id: 2, title: "Recruiter" }] } }),
}));

vi.mock("@/hooks/use-recruitment", () => ({
  useSaveJobOpening: () => ({ isPending: false, mutateAsync: mocks.saveJob }),
  useMyApplication: () => ({
    isLoading: false,
    data: {
      application: { id: "00000000-0000-0000-0000-000000000001", status: "Shortlisted", submitted_at: "2026-08-20T00:00:00Z", cover_note: "Interested" },
      history: [{ id: "00000000-0000-0000-0000-000000000002", next_status: "Shortlisted", note: null }],
      documents: [],
    },
  }),
  useTransitionApplicationStatus: () => ({ isPending: false, mutateAsync: mocks.transition }),
  useHireApplication: () => ({ isPending: false, mutateAsync: mocks.hire }),
  useApplicationAiScores: () => ({ data: mocks.scores, error: mocks.scoreError }),
  useRetryApplicationAnalysis: () => ({ isPending: false, mutateAsync: mocks.retry }),
  useHrApplications: () => ({ isLoading: false, error: null, data: { rows: mocks.applications } }),
}));

describe("HR recruitment workspace", () => {
  beforeEach(() => {
    mocks.scores = [];
    mocks.scoreError = null;
    mocks.applications = [];
  });

  it("saves a draft job opening with its qualification criteria", async () => {
    mocks.saveJob.mockResolvedValue({ id: 3 });
    const user = userEvent.setup();
    render(<HrJobForm />);

    await user.type(screen.getByLabelText("Title"), "Senior Recruiter");
    await user.type(screen.getByLabelText("Description"), "Lead recruitment operations across the organization.");
    await user.type(screen.getByLabelText("Qualification 1"), "Five years of experience");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mocks.saveJob).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ status: "draft", departmentId: 1, positionId: 2, criteria: [expect.objectContaining({ requirement: "Five years of experience" })] }),
    })));
  });

  it("allows HR to move an application forward and open the hire decision", async () => {
    mocks.transition.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    await user.selectOptions(screen.getByLabelText("Next status"), "Interview");
    await user.click(screen.getByRole("button", { name: "Update status" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: "00000000-0000-0000-0000-000000000001", nextStatus: "Interview", note: undefined });

    expect(screen.queryByRole("option", { name: "Hired" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hire applicant" }));
    expect(screen.getByRole("heading", { name: "Hire applicant" })).toBeInTheDocument();
  });

  it("shows queued analysis progress without asking HR to paste a CV", () => {
    mocks.scores = [{ id: "00000000-0000-0000-0000-000000000003", status: "queued", score: null, explanation: null }];
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    expect(screen.getByText("Analyzing application…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Approved anonymized CV text")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Analyze application" })).not.toBeInTheDocument();
  });

  it("shows a failed analysis as failed in both list and detail views", () => {
    mocks.scores = [{ id: "00000000-0000-0000-0000-000000000003", status: "failed", score: null, explanation: null, failure_code: "provider_unavailable" }];
    mocks.applications = [{ id: "00000000-0000-0000-0000-000000000001", status: "Submitted", submitted_at: "2026-08-20T00:00:00Z", ai_score_status: "failed", ai_score: null }];

    const { unmount } = render(<HrApplicationList />);
    expect(screen.getByText("AI recommendation: Analysis failed")).toBeInTheDocument();
    unmount();

    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByText(/Analysis failed/)).toBeInTheDocument();
    expect(screen.getByText(/You can retry when the service is available/)).toBeInTheDocument();
  });

  it("shows AI score loading errors instead of misreporting them as not analyzed", () => {
    mocks.scoreError = new Error("Unable to load recommendations");
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load recommendations");
    expect(screen.queryByText(/This may be an application submitted before/)).not.toBeInTheDocument();
  });
});
