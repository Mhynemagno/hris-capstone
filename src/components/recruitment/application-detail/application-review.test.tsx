import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "Application Submission", stageResult: "pending", documents: [] as Array<Record<string, unknown>>, missing: false, history: [] as Array<Record<string, unknown>> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/hr/applications/x", useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/components/workspace-shell/breadcrumbs", () => ({ useBreadcrumbTrail: vi.fn() }));
vi.mock("@/components/recruitment/stage-dialogs", () => ({
  StageResultDialog: ({ open, result }: { open: boolean; result: string }) => (open ? <div aria-label={`Record ${result}`} role="dialog" /> : null),
}));
vi.mock("./overview-tab", () => ({ OverviewTab: () => <p>overview content</p> }));
vi.mock("./profile-tab", () => ({ ProfileTab: () => <p>profile content</p> }));
vi.mock("./documents-tab", () => ({ DocumentsTab: () => <p>documents content</p> }));
vi.mock("./activity-tab", () => ({ ActivityTab: () => <p>activity content</p> }));
const accountMocks = vi.hoisted(() => ({ reopen: vi.fn(), reactivate: vi.fn(), send: vi.fn(), active: true }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: vi.fn() }));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useHrRegisteredApplicants: () => ({ data: [{ user_id: "u1", applicant_id: "a1", email: "ana@example.test", account_active: accountMocks.active }] }),
  useApplicantEducationFor: () => ({ data: [], error: null, refetch: vi.fn() }),
  useReopenApplicationForResubmission: () => ({ isPending: false, mutateAsync: accountMocks.reopen }),
  useReactivateApplicantAccount: () => ({ isPending: false, mutateAsync: accountMocks.reactivate }),
  useSendApplicantCredentials: () => ({ isPending: false, mutateAsync: accountMocks.send }),
}));
vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplication: () => (state.missing ? { isLoading: false, error: null, data: null } : {
    isLoading: false, error: null,
    data: {
      application: { id: "00000000-0000-0000-0000-000000000001", applicant_id: "a1", job_opening_id: 4, status: state.status, stage_result: state.stageResult, submitted_at: "2026-10-01T00:00:00Z", cover_note: null,
        applicants: { first_name: "Ana", middle_name: "Santos", last_name: "Reyes", qualifier: null, applicant_number: 12345, phone: "0917", profile_image_path: null },
        job_openings: { id: 4, title: "Patrol North" } },
      history: state.history,
      documents: state.documents,
    },
  }),
  useApplicantProfileDocumentsFor: () => ({ isLoading: false, error: null, data: [] }),
  useApplicantProfilePhotoUrl: () => ({ data: null }),
  useApplicationStageDocuments: () => ({ data: [] }),
}));

import { HrApplicationReview } from "./application-review";

describe("HrApplicationReview", () => {
  beforeEach(() => { accountMocks.active = true; accountMocks.reopen.mockReset().mockResolvedValue(undefined); accountMocks.reactivate.mockReset().mockResolvedValue(undefined); state.status = "Application Submission"; state.stageResult = "pending"; state.documents = []; state.missing = false; state.history = [{ id: "h", previous_status: null, next_status: "Application Submission", created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(), note: null }]; });

  it("names the applicant, links the job and shows how long they have been at this stage", () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("heading", { level: 1, name: "Ana Santos Reyes" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Patrol North" })[0]).toHaveAttribute("href", "/hr/jobs/4");
    expect(screen.getByText("in Application Submission for 4 days")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Application stages" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Application stages" })).getByText("Application Submission").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("complementary", { name: "Applicant details" })).toHaveTextContent("ana@example.test");
  });

  it("reopens a Not Selected application for resubmission with an optional note", async () => {
    state.status = "Not Selected";
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    await userEvent.click(screen.getByRole("button", { name: "Reopen for resubmission" }));
    const dialog = await screen.findByRole("dialog", { name: "Reopen for resubmission" });
    await userEvent.type(within(dialog).getByLabelText(/Note to applicant/), "Please upload a clearer diploma.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reopen application" }));
    expect(accountMocks.reopen).toHaveBeenCalledWith({ applicationId: "00000000-0000-0000-0000-000000000001", note: "Please upload a clearer diploma." });
  });

  it("offers HR account help: reactivate a deactivated applicant account", async () => {
    accountMocks.active = false;
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    await userEvent.click(screen.getByRole("button", { name: "Reactivate account" }));
    expect(accountMocks.reactivate).toHaveBeenCalledWith("u1");
    expect(screen.getByRole("button", { name: "Send new credentials" })).toBeDisabled();
  });

  it.each([
    ["Application Submission", "pending", ["Verified", "Passed", "Failed"], ["Scheduled", "Hire applicant", "Reopen for resubmission"]],
    ["Physical Agility Test", "pending", ["Scheduled", "Passed", "Failed"], ["Verified", "Hire applicant"]],
    ["Final Evaluation", "scheduled", ["Passed", "Failed"], ["Scheduled", "Hire applicant"]],
    ["Shortlisted", "pending", [], ["Passed", "Failed", "Hire applicant"]],
    ["Hired", "pending", [], ["Passed", "Failed", "Hire applicant"]],
    ["Not Selected", "pending", ["Reopen for resubmission"], ["Passed", "Failed", "Hire applicant"]],
  ])("shows the right actions at %s (%s)", (status, stageResult, present, absent) => {
    state.status = status;
    state.stageResult = stageResult;
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    for (const name of present) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    for (const name of absent) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("shows the client's status word next to the stage", () => {
    state.status = "Drug Test";
    state.stageResult = "scheduled";
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByText("Scheduled", { selector: "[data-slot=badge], span" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move to next stage" })).not.toBeInTheDocument();
  });

  it("opens the result dialog for the chosen result", async () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    await userEvent.click(screen.getByRole("button", { name: "Passed" }));
    expect(screen.getByRole("dialog", { name: "Record passed" })).toBeInTheDocument();
  });

  it("switches tabs", () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByText("overview content")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Documents/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Activity/ })).toBeInTheDocument();
  });

  it("says when the application does not exist", () => {
    state.missing = true;
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("heading", { level: 1, name: "Application not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to applications" })).toHaveAttribute("href", "/hr/applications");
  });
});
