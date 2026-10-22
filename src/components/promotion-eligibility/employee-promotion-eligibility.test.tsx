import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/hooks/use-promotion-eligibility", () => ({ useMyPromotionStatus: mocks.query }));
vi.mock("@/components/staff-shell/staff-notify", () => ({ notifyStaff: vi.fn() }));

import { EmployeePromotionEligibility } from "./employee-promotion-eligibility";

const evaluation = (overrides: Record<string, unknown> = {}) => ({
  employeeId: "11111111-1111-4111-8111-111111111111", employeeName: "Peters, Tyson", employeeNumber: "4-15889", evaluatedOn: "2026-10-22", isUniformed: true,
  currentRank: { id: 1, code: "PAT", name: "Patrolman / Patrolwoman" }, targetRank: { id: 2, code: "PCPL", name: "Police Corporal" }, reason: null,
  rankSince: "2022-01-01", timeInGradeMonths: 57, minimumTimeInGradeMonths: 36,
  trainings: [{ name: "Public Safety Junior Leadership Course (PSJLC)", code: "PSJLC", met: false, record: null }],
  eligibility: { required: true, record: null },
  iper: { minimum: "Satisfactory", periodMonths: 12, record: null },
  pft: { required: true, validityMonths: 12, record: null },
  requirements: [
    { key: "time_in_grade", label: "Time in grade (36 months as PAT)", met: true },
    { key: "training:PSJLC", label: "Training: Public Safety Junior Leadership Course (PSJLC)", met: false },
    { key: "eligibility", label: "Eligibility (e.g. NAPOLCOM) with rating", met: false },
  ],
  missingRequirements: ["Training: Public Safety Junior Leadership Course (PSJLC)", "Eligibility (e.g. NAPOLCOM) with rating"],
  isQualified: false,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("EmployeePromotionEligibility", () => {
  it("shows current rank to next rank, the automatic checklist and the missing requirements", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation(), decision: null, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("Police Corporal")).toBeVisible();
    expect(screen.getByText("PAT → PCPL")).toBeVisible();
    expect(screen.getByText("57 Mos")).toBeVisible();
    expect(screen.getByText("Requirements pending")).toBeVisible();
    const missing = screen.getByRole("region", { name: "Missing Requirements" });
    expect(within(missing).getByText("Eligibility (e.g. NAPOLCOM) with rating")).toBeVisible();
    expect(screen.getByRole("list", { name: "Requirements checklist" })).toHaveTextContent("No completed record on file.");
    expect(screen.queryByText(/publishes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Submit to Promotion Board/ })).not.toBeInTheDocument();
  });

  it("shows For approval when every requirement is met", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation({ requirements: [{ key: "time_in_grade", label: "Time in grade", met: true }], missingRequirements: [], isQualified: true }), decision: null, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("For approval")).toBeVisible();
    expect(screen.getByText("Every requirement is on record.")).toBeVisible();
  });

  it("reflects the HR decision with remarks", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation(), decision: { id: "22222222-2222-4222-8222-222222222222", status: "rejected", remarks: "No PSJLC certificate", decidedAt: "2026-10-21T02:00:00Z", targetRankId: 2 }, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText("Rejected by HR")).toBeVisible();
    const decision = screen.getByRole("region", { name: "HR decision" });
    expect(decision).toHaveTextContent("Rejected on October 21, 2026");
    expect(decision).toHaveTextContent("Remarks: No PSJLC certificate");
  });

  it("explains why non-uniformed personnel have no next rank", () => {
    mocks.query.mockReturnValue({ isLoading: false, error: null, data: { evaluation: evaluation({ targetRank: null, reason: "non_uniformed", requirements: [], missingRequirements: [] }), decision: null, history: [] } });
    render(<EmployeePromotionEligibility />);
    expect(screen.getByText(/not on the uniformed promotion ladder/)).toBeVisible();
  });
});
