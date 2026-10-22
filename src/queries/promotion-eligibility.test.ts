import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ rpc }),
}));

import { decidePromotion, listPromotionCandidatesPage, promotionCandidateFilters, recordIperRating, recordPftResult } from "./promotion-eligibility";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";
const recordId = "123e4567-e89b-42d3-a456-426614174099";

beforeEach(() => rpc.mockReset());

describe("promotion queries", () => {
  it("normalizes bounded dashboard filters", () => {
    expect(promotionCandidateFilters({ page: "2", pageSize: "200", status: "for_approval", search: "  " })).toEqual({ page: 2, pageSize: 100, status: "for_approval" });
  });

  it("lists system-evaluated candidates with the total count", async () => {
    rpc.mockResolvedValue({ data: [{ employee_id: employeeId, status: "for_approval", total_count: 3 }], error: null });
    const result = await listPromotionCandidatesPage({ page: 1, pageSize: 10, status: "for_approval", search: "cruz" });
    expect(rpc).toHaveBeenCalledWith("list_promotion_candidates_page", { target_search: "cruz", target_status: "for_approval", target_page: 1, target_page_size: 10, target_employee_id: null });
    expect(result.count).toBe(3);
  });

  it("records an HR decision; rejecting needs remarks", async () => {
    rpc.mockResolvedValue({ data: recordId, error: null });
    await expect(decidePromotion({ employeeId, approve: false, remarks: " " })).rejects.toThrow();
    await expect(decidePromotion({ employeeId, approve: true, remarks: "" })).resolves.toBe(recordId);
    expect(rpc).toHaveBeenCalledWith("decide_promotion", { target_employee_id: employeeId, target_approve: true, target_remarks: null });
  });

  it("records an adjectival IPER for a period of at most 6 months", async () => {
    rpc.mockResolvedValue({ data: recordId, error: null });
    await expect(recordIperRating({ employeeId, periodStartsOn: "2026-01-01", periodEndsOn: "2026-12-31", rating: "Outstanding" })).rejects.toThrow();
    await expect(recordIperRating({ employeeId, periodStartsOn: "2026-01-01", periodEndsOn: "2026-06-30", rating: "Very Satisfactory" })).resolves.toBe(recordId);
    expect(rpc).toHaveBeenCalledWith("record_iper_rating", { target_employee_id: employeeId, target_starts_on: "2026-01-01", target_ends_on: "2026-06-30", target_rating: "Very Satisfactory", target_notes: null });
  });

  it("records a passed or failed PFT", async () => {
    rpc.mockResolvedValue({ data: recordId, error: null });
    await recordPftResult({ employeeId, assessedOn: "2026-09-01", passed: true });
    expect(rpc).toHaveBeenCalledWith("record_pft_result", { target_employee_id: employeeId, target_assessed_on: "2026-09-01", target_passed: true, target_notes: null });
  });
});
