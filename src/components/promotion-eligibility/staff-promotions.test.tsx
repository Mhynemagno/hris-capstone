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
  recordBoard: vi.fn(),
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
vi.mock("@/hooks/use-promotion-scorecard", () => ({
  useRecordPromotionAssignment: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRecordPromotionAward: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useRecordPromotionBoardAssessment: () => ({ isPending: false, mutateAsync: mocks.recordBoard }),
}));

import { StaffPromotions } from "./staff-promotions";

const criteria = (boardState = "assessed") => [
  { key: "seniority", label: "Seniority / time in grade", points: 26, maximumPoints: 30, state: "calculated", evidence: { rankSince: "2020-01-01" } },
  { key: "assignment", label: "Diversity of assignment", points: 0, maximumPoints: 20, state: "missing", evidence: [] },
  { key: "awards", label: "Awards and recognition", points: 0, maximumPoints: 10, state: "missing", evidence: [] },
  { key: "iper", label: "IPER", points: 3.5, maximumPoints: 5, state: "calculated", evidence: ["Outstanding", "Very Satisfactory"] },
  { key: "board", label: "Interview", points: boardState === "assessed" ? 12 : 0, maximumPoints: 15, state: boardState, evidence: boardState === "assessed" ? { id: "88888888-8888-4888-8888-888888888888", score: 12, assessedOn: "2026-10-01", evidence: "Panel interview sheet" } : null },
  { key: "reputation", label: "Service reputation", points: boardState === "assessed" ? 22 : 0, maximumPoints: 20, state: boardState, evidence: null },
];

const evaluation = {
  employeeId: "11111111-1111-4111-8111-111111111111", employeeName: "Peters, Tyson", employeeNumber: "4-15889", evaluatedOn: "2026-10-22", isUniformed: true,
  currentRank: { id: 2, code: "PCPL", name: "Police Corporal" }, targetRank: { id: 3, code: "PSSG", name: "Police Staff Sergeant" }, reason: null,
  band: "PCPL-PMSG", totalScore: 63.5, maximumScore: 100, criteria: criteria(),
  eligibility: { record: { id: "44444444-4444-4444-8444-444444444444", name: "NAPOLCOM PNP Entrance Examination", rating: "85.50", awardedOn: "2021-06-01", documentPath: null, documentName: null } },
  requirements: [], missingRequirements: [],
};

const row = (overrides: Record<string, unknown> = {}) => ({
  employee_id: "11111111-1111-4111-8111-111111111111", employee_name: "Peters, Tyson", employee_number: "4-15889",
  rank_id: 2, rank_code: "PCPL", rank_name: "Police Corporal", target_rank_id: 3, target_rank_code: "PSSG", target_rank_name: "Police Staff Sergeant",
  status: "for_approval", decision_id: null, remarks: null, decided_at: null, score: 63.5, maximum_score: 100, band: "PCPL-PMSG", eligibility_rating: "85.50",
  evaluation, total_count: 3, ...overrides,
});

describe("StaffPromotions (system-evaluated promotion dashboard)", () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams();
    mocks.candidates.mockReturnValue({ isLoading: false, error: null, data: { count: 3, rows: [
      row(),
      row({ employee_id: "22222222-2222-4222-8222-222222222222", employee_name: "Cruz, Ana", status: "approved", decision_id: "77777777-7777-4777-8777-777777777777", decided_at: "2026-10-21T00:00:00Z", score: 40 }),
      row({ employee_id: "33333333-3333-4333-8333-333333333333", employee_name: "Santos, Lee", score: 0, eligibility_rating: null, evaluation: { ...evaluation, totalScore: 0, criteria: criteria("unassessed"), eligibility: { record: null } } }),
    ] } });
    mocks.evaluation.mockReturnValue({ isLoading: false, error: null, data: { evaluation, decision: null } });
    mocks.decide.mockResolvedValue("77777777-7777-4777-8777-777777777777");
  });
  afterEach(() => { mocks.replace.mockReset(); vi.clearAllMocks(); });

  it("lists every scorecard with its score, eligibility and status, including 0 / 100", () => {
    render(<StaffPromotions />);
    expect(screen.getByRole("heading", { level: 1, name: "Promotions Evaluation" })).toBeInTheDocument();
    expect(screen.getByText(/Scores follow the fixed PDF matrices and have no pass mark/)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Rank", "Name", "Target Rank", "Score", "Eligibility", "Status", "Actions"]);
    const first = screen.getByText("Peters, Tyson").closest("tr")!;
    expect(within(first).getByText("PCPL")).toBeInTheDocument();
    expect(within(first).getByText("PSSG — Police Staff Sergeant")).toBeInTheDocument();
    expect(within(first).getByText("63.5 / 100")).toBeInTheDocument();
    expect(within(first).getByText("NAPOLCOM PNP Entrance Examination — rating 85.50%")).toBeInTheDocument();
    expect(within(first).getByText("For approval")).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Approve promotion of Peters, Tyson to PSSG" })).toBeEnabled();
    const second = screen.getByText("Cruz, Ana").closest("tr")!;
    expect(within(second).getByText("Approved")).toBeInTheDocument();
    expect(within(second).queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "View details for Cruz, Ana" })).toBeInTheDocument();
    const third = screen.getByText("Santos, Lee").closest("tr")!;
    expect(within(third).getByText("0 / 100")).toBeInTheDocument();
    expect(within(third).getByText("None on record")).toBeInTheDocument();
    expect(within(third).getByText("Board assessment pending")).toBeInTheDocument();
    expect(within(third).getByRole("button", { name: "Approve promotion of Santos, Lee to PSSG" })).toBeDisabled();
    expect(within(third).getByRole("button", { name: "Reject promotion of Santos, Lee to PSSG" })).toBeDisabled();
    expect(screen.queryByText(/passed|recommended|qualified/i)).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Reject promotion of Peters, Tyson to PSSG" }));
    const dialog = screen.getByRole("dialog", { name: "Reject promotion" });
    await user.click(within(dialog).getByRole("button", { name: "Reject promotion" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter the reason for rejecting this promotion.");
    expect(mocks.decide).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(/Reason for rejection/), "Pending administrative case");
    await user.click(within(dialog).getByRole("button", { name: "Reject promotion" }));
    expect(mocks.decide).toHaveBeenCalledWith({ employeeId: "11111111-1111-4111-8111-111111111111", approve: false, remarks: "Pending administrative case" });
  });

  it("approves from the table", async () => {
    const user = userEvent.setup();
    render(<StaffPromotions />);
    await user.click(screen.getByRole("button", { name: "Approve promotion of Peters, Tyson to PSSG" }));
    await user.click(within(screen.getByRole("dialog", { name: "Approve promotion" })).getByRole("button", { name: "Approve promotion" }));
    expect(mocks.decide).toHaveBeenCalledWith({ employeeId: "11111111-1111-4111-8111-111111111111", approve: true, remarks: "" });
  });

  it("opens the details view with the score, criterion breakdown and eligibility outside the total", async () => {
    render(<StaffPromotions />);
    await userEvent.click(screen.getByRole("button", { name: "View details for Peters, Tyson" }));
    expect(mocks.replace).toHaveBeenCalledWith("/hr/promotions?view=11111111-1111-4111-8111-111111111111", { scroll: false });
    mocks.params = new URLSearchParams("view=11111111-1111-4111-8111-111111111111");
    render(<StaffPromotions />);
    const dialog = screen.getByRole("dialog", { name: "Promotion evaluation" });
    expect(dialog).toHaveTextContent("63.5 / 100");
    expect(dialog).toHaveTextContent("Eligibility (not scored)NAPOLCOM PNP Entrance Examination — rating 85.50%");
    const breakdown = within(dialog).getByRole("list", { name: "Scorecard breakdown" });
    expect(within(breakdown).getByText("Seniority / time in grade").closest("li")).toHaveTextContent("26 / 30");
    expect(within(breakdown).getByText("IPER").closest("li")).toHaveTextContent("Last two ratings: Outstanding, Very Satisfactory");
    expect(within(breakdown).getByText("Interview").closest("li")).toHaveTextContent("Panel interview sheet");
    expect(within(breakdown).getByText("Diversity of assignment").closest("li")).toHaveTextContent("No verified records yet");
    expect(within(breakdown).queryByRole("button", { name: "Add evidence for Seniority / time in grade" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("keeps decisions disabled until the Promotion Board assessments are recorded, then records one", async () => {
    const user = userEvent.setup();
    mocks.evaluation.mockReturnValue({ isLoading: false, error: null, data: { evaluation: { ...evaluation, totalScore: 0, criteria: criteria("unassessed") }, decision: null } });
    mocks.params = new URLSearchParams("view=11111111-1111-4111-8111-111111111111");
    mocks.recordBoard.mockResolvedValue("99999999-9999-4999-8999-999999999999");
    render(<StaffPromotions />);
    const dialog = screen.getByRole("dialog", { name: "Promotion evaluation" });
    expect(dialog).toHaveTextContent("Record the Promotion Board assessments before deciding.");
    expect(within(dialog).getByText("Interview").closest("li")).toHaveTextContent("Not yet assessed by the Promotion Board— / 15");
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Add evidence for Interview" }));
    const evidence = screen.getByRole("dialog", { name: "Record Promotion Board assessment" });
    await user.type(within(evidence).getByLabelText(/score/i), "12");
    await user.type(within(evidence).getByLabelText(/evidence/i), "Panel interview sheet");
    await user.click(within(evidence).getByRole("button", { name: "Save" }));
    expect(mocks.recordBoard).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "11111111-1111-4111-8111-111111111111", criterion: "board", band: "PCPL-PMSG", score: 12 }));
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
