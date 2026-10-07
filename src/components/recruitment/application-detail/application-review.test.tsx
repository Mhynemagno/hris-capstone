import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "Under Review", documents: [] as Array<Record<string, unknown>>, missing: false, history: [] as Array<Record<string, unknown>> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/hr/applications/x", useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/components/workspace-shell/breadcrumbs", () => ({ useBreadcrumbTrail: vi.fn() }));
vi.mock("@/components/recruitment/stage-dialogs", () => ({
  MoveStageDialog: ({ open }: { open: boolean }) => (open ? <div aria-label="Move to next stage" role="dialog" /> : null),
  NotSelectedDialog: ({ open }: { open: boolean }) => (open ? <div aria-label="Mark as not selected?" role="alertdialog" /> : null),
  HireDialog: ({ open }: { open: boolean }) => (open ? <div aria-label="Hire applicant" role="dialog" /> : null),
}));
vi.mock("./overview-tab", () => ({ OverviewTab: () => <p>overview content</p> }));
vi.mock("./profile-tab", () => ({ ProfileTab: () => <p>profile content</p> }));
vi.mock("./documents-tab", () => ({ DocumentsTab: () => <p>documents content</p> }));
vi.mock("./activity-tab", () => ({ ActivityTab: () => <p>activity content</p> }));
vi.mock("@/hooks/use-applicant-portal", () => ({ useHrRegisteredApplicants: () => ({ data: [{ applicant_id: "a1", email: "ana@example.test" }] }) }));
vi.mock("@/hooks/use-recruitment", () => ({
  useMyApplication: () => (state.missing ? { isLoading: false, error: null, data: null } : {
    isLoading: false, error: null,
    data: {
      application: { id: "00000000-0000-0000-0000-000000000001", applicant_id: "a1", job_opening_id: 4, status: state.status, submitted_at: "2026-10-01T00:00:00Z", cover_note: null,
        applicants: { first_name: "Ana", middle_name: "Santos", last_name: "Reyes", qualifier: null, applicant_number: 12345, phone: "0917", profile_image_path: null },
        job_openings: { id: 4, title: "Patrol North" } },
      history: state.history,
      documents: state.documents,
    },
  }),
  useApplicantProfileDocumentsFor: () => ({ isLoading: false, error: null, data: [] }),
  useApplicantProfilePhotoUrl: () => ({ data: null }),
}));

import { HrApplicationReview } from "./application-review";

describe("HrApplicationReview", () => {
  beforeEach(() => { state.status = "Under Review"; state.documents = []; state.missing = false; state.history = [{ id: "h", previous_status: "Submitted", next_status: "Under Review", created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(), note: null }]; });

  it("names the applicant, links the job and shows how long they have been at this stage", () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("heading", { level: 1, name: "Ana Santos Reyes" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Patrol North" })[0]).toHaveAttribute("href", "/hr/jobs/4");
    expect(screen.getByText("in Under Review for 4 days")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Application stages" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Application stages" })).getByText("Under Review").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("complementary", { name: "Applicant details" })).toHaveTextContent("ana@example.test");
  });

  it.each([
    ["Under Review", ["Move to next stage", "Not selected"], []],
    ["For Training", ["Hire applicant", "Not selected"], ["Move to next stage"]],
    ["Hired", [], ["Move to next stage", "Hire applicant", "Not selected"]],
    ["Needs Revision", [], ["Move to next stage"]],
  ])("shows the right actions at %s", (status, present, absent) => {
    state.status = status;
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    for (const name of present) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    for (const name of absent) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("disables moving on while the BMI proof is missing", () => {
    state.status = "Endorsed to Crame";
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole("button", { name: "Move to next stage" })).toBeDisabled();
    expect(screen.getByText("Waiting for the applicant's BMI proof")).toBeInTheDocument();
  });

  it("opens the move dialog", async () => {
    render(<HrApplicationReview applicationId="00000000-0000-0000-0000-000000000001" />);
    await userEvent.click(screen.getByRole("button", { name: "Move to next stage" }));
    expect(screen.getByRole("dialog", { name: "Move to next stage" })).toBeInTheDocument();
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
