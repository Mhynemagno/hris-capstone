import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/hooks/use-promotion-eligibility", () => ({ useMyPromotionStatus: mocks.query }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: vi.fn() }));

import { EmployeePromotionEligibility } from "./employee-promotion-eligibility";

const criteria = (overrides: { board?: object; reputation?: object } = {}) => [
  { key: "seniority", label: "Seniority / time in grade", points: 17, maximumPoints: 30, state: "calculated" },
  { key: "assignment", label: "Diversity of assignment", points: 0, maximumPoints: 20, state: "missing" },
  { key: "awards", label: "Awards and recognition", points: 0.5, maximumPoints: 10, state: "calculated" },
  { key: "iper", label: "IPER", points: 0, maximumPoints: 5, state: "missing" },
  { key: "board", label: "Interview", points: 0, maximumPoints: 15, state: "unassessed", ...overrides.board },
  { key: "reputation", label: "Service reputation", points: 0, maximumPoints: 20, state: "unassessed", ...overrides.reputation },
];

const evaluation = (overrides: Record<string, unknown> = {}) => ({
  employeeId: "11111111-1111-4111-8111-111111111111", employeeName: "Peters, Tyson", employeeNumber: "4-15889", evaluatedOn: "2026-10-22", isUniformed: true,
  currentRank: { id: 2, code: "PCPL", name: "Police Corporal" }, targetRank: { id: 3, code: "PSSG", name: "Police Staff Sergeant" }, reason: null,
  band: "PCPL-PMSG", totalScore: 17.5, maximumScore: 100, criteria: criteria(),
  eligibility: { record: { id: "44444444-4444-4444-8444-444444444444", name: "NAPOLCOM PNP Entrance Examination", rating: "85.50", awardedOn: "2021-06-01", documentPath: null, documentName: null } },
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("EmployeePromotionEligibility", () => {
  it("shows the next rank, the score out of 100 and every criterion without a pass label", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation(), decision: null, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("Police Staff Sergeant")).toBeVisible();
    expect(screen.getByText("PCPL → PSSG")).toBeVisible();
    expect(screen.getByText("17.5 / 100")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Promotion score" })).toHaveAttribute("aria-valuenow", "17.5");
    expect(screen.getByText("Awaiting Promotion Board")).toBeVisible();
    const breakdown = screen.getByRole("list", { name: "Scorecard breakdown" });
    expect(within(breakdown).getAllByRole("listitem")).toHaveLength(6);
    expect(within(breakdown).getByText("Seniority / time in grade").closest("li")).toHaveTextContent("17 / 30");
    expect(within(breakdown).getByText("Awards and recognition").closest("li")).toHaveTextContent("0.5 / 10");
    expect(within(breakdown).getByText("Interview").closest("li")).toHaveTextContent("Not yet assessed by the Promotion Board— / 15");
    expect(within(breakdown).getByText("Diversity of assignment").closest("li")).toHaveTextContent("No verified records yet0 / 20");
    expect(screen.queryByRole("button", { name: /Add evidence/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/pass|recommended|qualified/i)).not.toBeInTheDocument();
  });

  it("shows eligibility and its rating outside the score", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation(), decision: null, history: [] } });
    render(<EmployeePromotionEligibility />);
    const overview = screen.getByRole("region", { name: "Promotion overview" });
    expect(overview).toHaveTextContent("NAPOLCOM PNP Entrance Examination — rating 85.50%");
    expect(overview).toHaveTextContent("not part of the score");
  });

  it("shows For approval once the Promotion Board has assessed the employee, even at 0 / 100", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation({ totalScore: 0, criteria: criteria({ board: { state: "assessed" }, reputation: { state: "assessed" } }) }), decision: null, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("0 / 100")).toBeVisible();
    expect(screen.getByText("For approval")).toBeVisible();
  });

  it("reflects the HR decision with remarks", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation(), decision: { id: "22222222-2222-4222-8222-222222222222", status: "rejected", remarks: "Insufficient time in grade", decidedAt: "2026-10-21T02:00:00Z", targetRankId: 3 }, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("Rejected by HR")).toBeVisible();
    const decision = screen.getByRole("region", { name: "HR decision" });
    expect(decision).toHaveTextContent("Rejected on October 21, 2026");
    expect(decision).toHaveTextContent("Remarks: Insufficient time in grade");
  });

  it("explains why a PAT is not scored", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation({ targetRank: null, reason: "below_scored_rank", criteria: undefined }), decision: null, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText(/not covered by the official promotion scorecards/)).toBeVisible();
  });
});
