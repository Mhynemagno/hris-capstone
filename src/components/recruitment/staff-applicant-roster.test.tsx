import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transition: vi.fn(), notify: vi.fn(), params: new URLSearchParams(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/hr/applications",
  useRouter: () => ({ replace: mocks.replace, push: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/components/recruitment/hr-registered-applicants", () => ({
  RegisteredApplicantDrawer: ({ applicant }: { applicant: { first_name: string } | null }) => (applicant ? <div role="dialog">Drawer for {applicant.first_name}</div> : null),
}));
vi.mock("@/hooks/use-applicant-portal", () => ({
  useHrRegisteredApplicants: () => ({
    isLoading: false,
    error: null,
    data: [{ user_id: "u2", first_name: "Maria", middle_name: null, last_name: "Santos", qualifier: null, full_name: "Maria Santos", email: "maria@example.test", application_count: 0, registered_at: "2026-10-10T00:00:00Z", applicant_number: null }],
  }),
}));
vi.mock("@/hooks/use-recruitment", () => ({
  useAllHrApplications: () => ({
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    data: [{ id: "11111111-1111-4111-8111-111111111111", applicant_name: "Aldrick Jamlani", applicant_number: 202613, job_opening_id: 7, job_title: "SAN JUAN CITY RECRUITMENT - CY 2026", status: "Application Submission", stage_result: "pending", submitted_at: "2026-10-11T00:00:00Z", ai_score_status: "completed", ai_score: 100 }],
  }),
  useAllHrJobs: () => ({ data: [{ id: 7, title: "SAN JUAN CITY RECRUITMENT - CY 2026" }] }),
  useTransitionApplicationStatus: () => ({ mutateAsync: mocks.transition, isPending: false }),
}));

import { StaffApplicantRoster } from "./staff-applicant-roster";

const APPLICATION_ID = "11111111-1111-4111-8111-111111111111";

describe("StaffApplicantRoster (roster.html)", () => {
  beforeEach(() => { mocks.params = new URLSearchParams(); });
  afterEach(() => { mocks.transition.mockReset(); mocks.notify.mockReset(); });

  it("shows the roster header, views and the application row", () => {
    render(<StaffApplicantRoster />);
    expect(screen.getByRole("heading", { level: 1, name: "APPLICANT ROSTER" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Applications" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Registered Applicants" })).toHaveAttribute("aria-pressed", "false");
    const row = screen.getByText("Aldrick Jamlani").closest("tr")!;
    expect(within(row).getByText("ID: 2-02613")).toBeInTheDocument();
    expect(within(row).getByText("Pending / For Evaluation")).toBeInTheDocument();
    expect(within(row).getByText("5 / 5")).toBeInTheDocument();
    expect(within(row).getByText("Excellent Match")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "View Profile" })).toHaveAttribute("href", `/hr/applications/${APPLICATION_ID}`);
    expect(within(row).getByRole("link", { name: "Edit Candidate" })).toHaveAttribute("href", `/hr/applications/${APPLICATION_ID}#stage-actions`);
  });

  it("shows registered applicants who have not submitted as Pending, with View only", async () => {
    render(<StaffApplicantRoster />);
    const row = screen.getByText("Santos, Maria").closest("tr")!;
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    expect(within(row).getAllByRole("button")).toHaveLength(1);
    await userEvent.click(within(row).getByRole("button", { name: "View Profile" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Drawer for Maria");
  });

  it("offers Pending and every stage in the status filter", () => {
    render(<StaffApplicantRoster />);
    const status = screen.getByRole("combobox", { name: "Status" });
    expect(within(status).getByRole("option", { name: "Pending" })).toBeInTheDocument();
    expect(within(status).getByRole("option", { name: "Physical Agility Test" })).toBeInTheDocument();
  });

  it("disqualifies an applicant only with a reason, without a delete-candidate action", async () => {
    mocks.transition.mockResolvedValue(undefined);
    render(<StaffApplicantRoster />);
    const row = screen.getByText("Aldrick Jamlani").closest("tr")!;
    expect(within(row).queryByRole("button", { name: /delete candidate/i })).not.toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", { name: "Disqualify Applicant" }));
    const dialog = await screen.findByRole("dialog", { name: "Disqualify applicant?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Disqualify" }));
    expect(within(dialog).getByText("Enter a reason.")).toBeInTheDocument();
    expect(mocks.transition).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/Reason/), "Failed requirements");
    await userEvent.click(within(dialog).getByRole("button", { name: "Disqualify" }));
    expect(mocks.transition).toHaveBeenCalledWith({ applicationId: APPLICATION_ID, nextStatus: "Not Selected", note: "Failed requirements" });
    expect(mocks.notify).toHaveBeenCalledWith({ title: "Applicant disqualified" });
  });
});
