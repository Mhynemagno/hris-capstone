import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
  candidates: vi.fn(),
  decide: vi.fn(),
  evaluation: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/promotions", useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: mocks.notify }));
vi.mock("@/hooks/use-administration", () => ({
  useRankOptions: () => ({ data: [{ id: 1, name: "Patrolman / Patrolwoman", code: "PAT", sort_order: 1, is_active: true }, { id: 2, name: "Police Corporal", code: "PCPL", sort_order: 2, is_active: true }] }),
}));
vi.mock("@/hooks/use-promotion-eligibility", () => ({
  usePromotionCandidates: mocks.candidates,
  usePromotionEvaluation: mocks.evaluation,
  usePromotionRankRequirements: () => ({ isLoading: false, error: null, data: [{ target_rank_id: 2, min_time_in_grade_months: 36, required_training: ["Public Safety Junior Leadership Course (PSJLC)"], requires_eligibility: true, min_iper: "Satisfactory", iper_period_months: 12, requires_pft_passed: true, pft_validity_months: 12, updated_at: "2026-10-22T00:00:00Z" }] }),
  usePromotionEmployees: () => ({ isLoading: false, data: [] }),
  useDecidePromotion: () => ({ isPending: false, mutateAsync: mocks.decide }),
  useRecordIperRating: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRecordPftResult: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { StaffPromotions } from "./staff-promotions";

const row = (overrides: Record<string, unknown> = {}) => ({
  employee_id: "11111111-1111-4111-8111-111111111111", employee_name: "Peters, Tyson", employee_number: "4-15889",
  rank_id: 1, rank_code: "PAT", rank_name: "Patrolman / Patrolwoman", target_rank_id: 2, target_rank_code: "PCPL", target_rank_name: "Police Corporal",
  status: "for_approval", decision_id: null, remarks: null, decided_at: null, total_count: 2, ...overrides,
});

const evaluation = {
  employeeId: "11111111-1111-4111-8111-111111111111", employeeName: "Peters, Tyson", employeeNumber: "4-15889", evaluatedOn: "2026-10-22", isUniformed: true,
  currentRank: { id: 1, code: "PAT", name: "Patrolman / Patrolwoman" }, targetRank: { id: 2, code: "PCPL", name: "Police Corporal" }, reason: null,
  rankSince: "2022-01-01", timeInGradeMonths: 57, minimumTimeInGradeMonths: 36,
  trainings: [{ name: "Public Safety Junior Leadership Course (PSJLC)", code: "PSJLC", met: true, record: { recordKind: "certification", recordId: "33333333-3333-4333-8333-333333333333", recordName: "Public Safety Junior Leadership Course (PSJLC)", completedOn: "2026-05-01", documentPath: "certifications/x/y.pdf", documentName: "psjlc.pdf" } }],
  eligibility: { required: true, record: { id: "44444444-4444-4444-8444-444444444444", name: "NAPOLCOM PNP Entrance Examination", rating: "85.50%", awardedOn: "2021-06-01", documentPath: null, documentName: null } },
  iper: { minimum: "Satisfactory", periodMonths: 12, record: { id: "55555555-5555-4555-8555-555555555555", rating: "Very Satisfactory", periodStartsOn: "2026-01-01", periodEndsOn: "2026-06-30" } },
  pft: { required: true, validityMonths: 12, record: { id: "66666666-6666-4666-8666-666666666666", result: "passed", score: null, assessedOn: "2026-09-01" } },
  requirements: [
    { key: "time_in_grade", label: "Time in grade (36 months as PAT)", met: true },
    { key: "training:PSJLC", label: "Training: Public Safety Junior Leadership Course (PSJLC)", met: true },
    { key: "eligibility", label: "Eligibility (e.g. NAPOLCOM) with rating", met: true },
    { key: "iper", label: "IPER: Satisfactory or better (last 12 months)", met: true },
    { key: "pft", label: "PFT: Passed (last 12 months)", met: true },
  ],
  missingRequirements: [],
  isQualified: true,
};

describe("StaffPromotions (system-evaluated promotion dashboard)", () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams();
    mocks.candidates.mockReturnValue({ isLoading: false, error: null, data: { count: 2, rows: [row(), row({ employee_id: "22222222-2222-4222-8222-222222222222", employee_name: "Cruz, Ana", status: "approved", decision_id: "77777777-7777-4777-8777-777777777777", decided_at: "2026-10-21T00:00:00Z" })] } });
    mocks.evaluation.mockReturnValue({ isLoading: false, error: null, data: { evaluation, decision: null } });
    mocks.decide.mockResolvedValue("77777777-7777-4777-8777-777777777777");
  });
  afterEach(() => { mocks.replace.mockReset(); vi.clearAllMocks(); });

  it("lists Rank, Name, Target Rank, Status and Actions without any criteria form", () => {
    render(<StaffPromotions />);
    expect(screen.getByRole("heading", { level: 1, name: "Promotions Evaluation" })).toBeInTheDocument();
    expect(screen.getByText(/The system lists personnel who meet the requirements for their next rank/)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Rank", "Name", "Target Rank", "Status", "Actions"]);
    const first = screen.getByText("Peters, Tyson").closest("tr")!;
    expect(within(first).getByText("PAT")).toBeInTheDocument();
    expect(within(first).getByText("PCPL — Police Corporal")).toBeInTheDocument();
    expect(within(first).getByText("For approval")).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Approve promotion of Peters, Tyson to PCPL" })).toBeInTheDocument();
    const second = screen.getByText("Cruz, Ana").closest("tr")!;
    expect(within(second).getByText("Approved")).toBeInTheDocument();
    expect(within(second).queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "View details for Cruz, Ana" })).toBeInTheDocument();
    expect(screen.queryByText(/Add Promotion Criteria/i)).not.toBeInTheDocument();
  });

  it("filters by status on the server", async () => {
    render(<StaffPromotions />);
    await userEvent.selectOptions(screen.getByLabelText("Status"), "rejected");
    expect(mocks.candidates).toHaveBeenLastCalledWith(expect.objectContaining({ status: "rejected", page: 1 }));
  });

  it("rejects with a required reason", async () => {
    const user = userEvent.setup();
    render(<StaffPromotions />);
    await user.click(screen.getByRole("button", { name: "Reject promotion of Peters, Tyson to PCPL" }));
    const dialog = screen.getByRole("dialog", { name: "Reject promotion" });
    await user.click(within(dialog).getByRole("button", { name: "Reject promotion" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter the reason for rejecting this promotion.");
    expect(mocks.decide).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/Reason for rejection/), "No PSJLC certificate");
    await user.click(within(dialog).getByRole("button", { name: "Reject promotion" }));
    expect(mocks.decide).toHaveBeenCalledWith({ employeeId: "11111111-1111-4111-8111-111111111111", approve: false, remarks: "No PSJLC certificate" });
  });

  it("approves from the table", async () => {
    const user = userEvent.setup();
    render(<StaffPromotions />);
    await user.click(screen.getByRole("button", { name: "Approve promotion of Peters, Tyson to PCPL" }));
    await user.click(within(screen.getByRole("dialog", { name: "Approve promotion" })).getByRole("button", { name: "Approve promotion" }));
    expect(mocks.decide).toHaveBeenCalledWith({ employeeId: "11111111-1111-4111-8111-111111111111", approve: true, remarks: "" });
  });

  it("opens the details view with the checklist, eligibility rating, IPER and PFT", async () => {
    render(<StaffPromotions />);
    await userEvent.click(screen.getByRole("button", { name: "View details for Peters, Tyson" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/promotions?view=11111111-1111-4111-8111-111111111111", { scroll: false });
    mocks.params = new URLSearchParams("view=11111111-1111-4111-8111-111111111111");
    render(<StaffPromotions />);
    const dialog = screen.getByRole("dialog", { name: "Promotion evaluation" });
    const checklist = within(dialog).getByRole("list", { name: "Requirements checklist" });
    expect(checklist).toHaveTextContent("NAPOLCOM PNP Entrance Examination — rating 85.50%");
    expect(checklist).toHaveTextContent("Very Satisfactory for January 1, 2026 to June 30, 2026.");
    expect(checklist).toHaveTextContent("Passed on September 1, 2026.");
    expect(within(checklist).getByRole("button", { name: "View proof: psjlc.pdf" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("shows the read-only policy matrix with eligibility and next-rank training", () => {
    mocks.params = new URLSearchParams("criteria=1");
    render(<StaffPromotions />);
    const panel = screen.getByRole("dialog", { name: "Official promotion policy matrix" });
    expect(panel).toHaveTextContent("PLT–PLTCOL");
    expect(within(panel).getAllByText(/appropriate eligibility \(e\.g\. NAPOLCOM\) with rating/)).toHaveLength(3);
    expect(panel).toHaveTextContent("Public Safety Junior Leadership Course (PSJLC)");
    expect(within(panel).queryByRole("combobox", { name: "Target Rank" })).not.toBeInTheDocument();
  });

  it("opens the Record IPER / PFT dialog", async () => {
    render(<StaffPromotions />);
    await userEvent.click(screen.getByRole("button", { name: "Record IPER / PFT" }));
    const dialog = screen.getByRole("dialog", { name: "Record IPER / PFT" });
    expect(within(dialog).getByLabelText("Adjectival rating")).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Very Satisfactory" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Passed" })).toBeInTheDocument();
  });
});
