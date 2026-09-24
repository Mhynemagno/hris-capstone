import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  applicationStatus: "Shortlisted",
}));

vi.mock("@/hooks/use-administration", () => ({
  useDepartmentOptions: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: 1, name: "People", is_active: true, created_at: "", updated_at: "" },
      { id: 5, name: "Finance", is_active: true, created_at: "", updated_at: "" },
    ],
  }),
  usePositionOptions: () => ({
    isLoading: false,
    error: null,
    data: [
      { id: 2, department_id: 1, title: "Recruiter", code: null, description: null, is_active: true, created_at: "", updated_at: "" },
      { id: 3, department_id: 1, title: "Retired Recruiter", code: null, description: null, is_active: false, created_at: "", updated_at: "" },
      { id: 6, department_id: 5, title: "Accountant", code: null, description: null, is_active: true, created_at: "", updated_at: "" },
    ],
  }),
}));

vi.mock("@/hooks/use-recruitment", () => ({
  useSaveJobOpening: () => ({ isPending: false, mutateAsync: mocks.saveJob }),
  useMyApplication: () => ({
    isLoading: false,
    data: {
      application: { id: "00000000-0000-0000-0000-000000000001", status: mocks.applicationStatus, submitted_at: "2026-08-20T00:00:00Z", cover_note: "Interested", applicants: { applicant_number: 12345 } },
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
    mocks.applicationStatus = "Shortlisted";
    mocks.saveJob.mockReset();
    mocks.transition.mockReset();
  });

  it("saves a draft job opening with its qualification criteria", async () => {
    mocks.saveJob.mockResolvedValue({ id: 3 });
    const user = userEvent.setup();
    render(<HrJobForm />);

    expect(screen.getByLabelText(/^department/i)).toHaveValue("");
    expect(screen.getByLabelText(/^position/i)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/^department/i), "1");
    // Only active positions in the chosen department are offered.
    expect(screen.getByRole("option", { name: "Recruiter" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /retired recruiter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Accountant" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^position/i), "2");
    await user.click(screen.getByLabelText(/^title/i));
    await user.paste("Senior Recruiter");
    await user.click(screen.getByLabelText(/^description/i));
    await user.paste("Lead recruitment operations across the organization.");
    await user.click(screen.getByLabelText("Qualification 1"));
    await user.paste("Five years of experience");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(mocks.saveJob).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ status: "draft", departmentId: 1, positionId: 2, criteria: [expect.objectContaining({ requirement: "Five years of experience" })] }),
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Draft saved.");
  });

  it("requires a department and position instead of defaulting to the first one", async () => {
    const user = userEvent.setup();
    render(<HrJobForm />);

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Select a department.")).toBeInTheDocument();
    expect(screen.getByText("Select a position.")).toBeInTheDocument();
    expect(mocks.saveJob).not.toHaveBeenCalled();
  });

  it("resets the position when the department changes", async () => {
    const user = userEvent.setup();
    render(<HrJobForm />);

    await user.selectOptions(screen.getByLabelText(/^department/i), "1");
    await user.selectOptions(screen.getByLabelText(/^position/i), "2");
    await user.selectOptions(screen.getByLabelText(/^department/i), "5");

    expect(screen.getByLabelText(/^position/i)).toHaveValue("");
    expect(screen.getByRole("option", { name: "Accountant" })).toBeInTheDocument();
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

  it("shows a failed analysis as failed in both list and detail views", () => {
    mocks.scores = [{ id: "00000000-0000-0000-0000-000000000003", status: "failed", score: null, explanation: null, failure_code: "provider_unavailable" }];
    mocks.applications = [{ id: "00000000-0000-0000-0000-000000000001", status: "Submitted", submitted_at: "2026-08-20T00:00:00Z", ai_score_status: "failed", ai_score: null }];

    const { unmount } = render(<HrApplicationList />);
    expect(screen.getByRole("columnheader", { name: "AI recommendation" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Analysis failed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review application 00000000/i })).toHaveAttribute("href", "/hr/applications/00000000-0000-0000-0000-000000000001");
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

  it.each([
    ["Submitted", ["Under Review"]],
    ["Under Review", ["Shortlisted", "Interview", "Needs Revision", "Not Selected"]],
    ["Shortlisted", ["Interview", "Needs Revision", "Not Selected"]],
    ["Interview", ["Shortlisted", "Needs Revision", "Not Selected"]],
  ])("offers only the database-allowed next statuses from %s", (status, expected) => {
    mocks.applicationStatus = status;
    render(<HrApplicationDetail applicationId="00000000-0000-0000-0000-000000000001" />);

    const options = within(screen.getByLabelText("Next status")).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Choose next status", ...expected]);
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
    await user.type(screen.getByLabelText("Note"), "Position filled");
    await user.click(screen.getByRole("button", { name: "Update status" }));
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "Not Selected", note: "Position filled" }));
    expect(await screen.findByText("Invalid application status transition.")).toBeInTheDocument();
  });
});
