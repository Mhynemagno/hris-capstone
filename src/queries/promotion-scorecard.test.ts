import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ rpc }),
}));

import { recordPromotionAssignment, recordPromotionAward, recordPromotionBoardAssessment } from "./promotion-scorecard";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";
const recordId = "123e4567-e89b-42d3-a456-426614174099";

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: recordId, error: null });
});

describe("promotion scorecard evidence queries", () => {
  it("records a validated assignment through the HR RPC", async () => {
    await expect(recordPromotionAssignment({ employeeId, kind: "geographic", region: null, startedOn: "2026-01-01", endedOn: "2026-06-30", evidence: "Orders" })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    await expect(recordPromotionAssignment({ employeeId, kind: "geographic", region: "Mindanao", startedOn: "2026-01-01", endedOn: "2026-06-30", evidence: " Orders " })).resolves.toBe(recordId);
    expect(rpc).toHaveBeenCalledWith("record_promotion_assignment", { target_employee_id: employeeId, target_kind: "geographic", target_region: "Mindanao", target_starts_on: "2026-01-01", target_ends_on: "2026-06-30", target_evidence: "Orders" });
  });

  it("records a policy award against the present rank", async () => {
    await recordPromotionAward({ employeeId, awardKey: "medalya_ng_papuri", awardedOn: "2026-02-01", presentRankId: 3, evidence: "Citation" });
    expect(rpc).toHaveBeenCalledWith("record_promotion_award", { target_employee_id: employeeId, target_award_key: "medalya_ng_papuri", target_awarded_on: "2026-02-01", target_present_rank_id: 3, target_evidence: "Citation" });
  });

  it("records a bounded Promotion Board score and surfaces RPC errors", async () => {
    await expect(recordPromotionBoardAssessment({ employeeId, criterion: "board", band: "PSMS-PEMS", assessedOn: "2026-03-01", score: 11, evidence: "Panel sheet" })).rejects.toThrow("cannot exceed 10");
    await recordPromotionBoardAssessment({ employeeId, criterion: "board", band: "PSMS-PEMS", assessedOn: "2026-03-01", score: "9.5", evidence: "Panel sheet" });
    expect(rpc).toHaveBeenCalledWith("record_promotion_board_assessment", { target_employee_id: employeeId, target_criterion: "board", target_band: "PSMS-PEMS", target_assessed_on: "2026-03-01", target_score: 9.5, target_evidence: "Panel sheet" });
    rpc.mockResolvedValue({ data: null, error: { message: "Only active HR personnel can do this." } });
    await expect(recordPromotionBoardAssessment({ employeeId, criterion: "reputation", band: "PSMS-PEMS", assessedOn: "2026-03-01", score: 20, evidence: "Records" })).rejects.toThrow("Only active HR");
  });
});
