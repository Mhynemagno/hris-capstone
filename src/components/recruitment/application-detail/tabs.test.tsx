import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remark: vi.fn(), retry: vi.fn(), notify: vi.fn(), scores: [] as Array<Record<string, unknown>>, profileUrl: vi.fn(), appUrl: vi.fn() }));
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: mocks.notify }));
vi.mock("@/queries/recruitment", () => ({ getApplicantProfileDocumentUrl: mocks.profileUrl, getApplicantDocumentUrl: mocks.appUrl }));
vi.mock("@/hooks/use-recruitment", () => ({
  useApplicationAiScores: () => ({ data: mocks.scores, error: null }),
  useRetryApplicationAnalysis: () => ({ isPending: false, mutateAsync: mocks.retry }),
  useAddApplicationRemark: () => ({ isPending: false, mutateAsync: mocks.remark }),
}));

import { ActivityTab } from "./activity-tab";
import { DocumentsTab } from "./documents-tab";
import { OverviewTab } from "./overview-tab";
import { ProfileTab } from "./profile-tab";

const id = "00000000-0000-0000-0000-000000000001";
const profileDocuments = [{ id: "d1", kind: "resume", file_name: "resume.pdf", object_path: "p/resume.pdf", updated_at: "2026-10-01T00:00:00Z" }] as never[];
const history = [
  { id: "h1", application_id: id, actor_user_id: null, previous_status: null, next_status: "Submitted", note: null, created_at: "2026-10-01T00:00:00Z" },
  { id: "h2", application_id: id, actor_user_id: "x", previous_status: "Submitted", next_status: "Submitted", note: "Passed the BMI at Crame.", created_at: "2026-10-02T00:00:00Z" },
] as never[];

describe("applicant detail tabs", () => {
  beforeEach(() => { mocks.scores = []; mocks.remark.mockReset(); mocks.retry.mockReset(); mocks.notify.mockReset(); });

  it("summarises the AI match, document checklist and latest remark on Overview", async () => {
    mocks.scores = [{ id: "s", status: "completed", score: 82, explanation: "Strong fit", failure_code: null }];
    const onShowDocuments = vi.fn();
    render(<OverviewTab applicationId={id} coverNote="I am ready." history={history} onShowDocuments={onShowDocuments} profileDocuments={profileDocuments} />);
    expect(screen.getByRole("region", { name: "AI match" })).toHaveTextContent("82/100");
    expect(screen.getByText("1 of 5 required documents uploaded")).toBeInTheDocument();
    expect(screen.getByText(/Missing: PSA birth certificate, 2x2 picture, Eligibility, Diploma/)).toBeInTheDocument();
    expect(screen.getByText("Passed the BMI at Crame.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View documents" }));
    expect(onShowDocuments).toHaveBeenCalled();
  });

  it("offers a retry when analysis failed or timed out", async () => {
    mocks.scores = [{ id: "s", status: "failed", score: null, explanation: null, failure_code: "timed_out" }];
    render(<OverviewTab applicationId={id} coverNote={null} history={[]} onShowDocuments={() => undefined} profileDocuments={[]} />);
    expect(screen.getByRole("region", { name: "AI match" })).toHaveTextContent("Analysis timed out");
    await userEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
    expect(mocks.retry).toHaveBeenCalledWith(id);
  });

  it("groups profile and application documents and marks missing ones", () => {
    render(<DocumentsTab applicationDocuments={[{ id: "a1", application_id: id, kind: "bmi_proof", object_path: "x/bmi.pdf", file_name: "bmi.pdf", mime_type: "application/pdf", size_bytes: 1, uploaded_by_user_id: null, created_at: "2026-10-03T00:00:00Z" }]} profileDocuments={profileDocuments} />);
    const required = screen.getByRole("region", { name: "Required profile documents" });
    expect(within(required).getByRole("button", { name: "View CV / Resume: resume.pdf" })).toBeInTheDocument();
    expect(within(required).getAllByText("Not uploaded")).toHaveLength(4);
    expect(within(screen.getByRole("region", { name: "Submitted with this application" })).getByRole("button", { name: "View BMI proof: bmi.pdf" })).toBeInTheDocument();
  });

  it("adds a remark from the Activity tab and lists the history newest first", async () => {
    mocks.remark.mockResolvedValue(undefined);
    render(<ActivityTab applicationId={id} history={history} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Passed the BMI at Crame.");
    await userEvent.click(screen.getByRole("button", { name: "Add remark" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a remark.");
    await userEvent.type(screen.getByLabelText("Remark"), "Called the applicant.");
    await userEvent.click(screen.getByRole("button", { name: "Add remark" }));
    expect(mocks.remark).toHaveBeenCalledWith({ applicationId: id, remark: "Called the applicant." });
    expect(mocks.notify).toHaveBeenCalledWith("Remark added · applicant notified");
  });

  it("shows Not provided for empty profile fields", () => {
    render(<ProfileTab applicant={{ id: "a", profile_id: "p", applicant_number: 1, first_name: "Ana", middle_name: null, last_name: "Reyes", qualifier: null, place_of_birth: null, date_of_birth: "1998-04-12", gender: "female", civil_status: null, religion: null, citizenship: "Filipino", profile_image_path: null, phone: "0917", address: null, created_at: "", updated_at: "" }} />);
    expect(screen.getByRole("heading", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByText("April 12, 1998")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
  });
});
