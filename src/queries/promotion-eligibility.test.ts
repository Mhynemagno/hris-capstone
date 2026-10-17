import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ rpc }),
}));

import { createPromotionCriterion, promotionEvaluationFilters, submitEmployeePromotionDocket } from "./promotion-eligibility";

describe("promotion eligibility queries", () => {
  it("normalizes bounded HR directory filters before requesting data", () => {
    expect(promotionEvaluationFilters({ page: "2", pageSize: "200", readiness: "ready", recommendation: "recommended" })).toEqual({
      page: 2,
      pageSize: 100,
      readiness: "ready",
      recommendation: "recommended",
    });
  });

  it("creates criteria with all configured evaluation groups", async () => {
    rpc.mockResolvedValue({ data: "c1", error: null });
    const requirements = ["PSJLC", "PSOAC"].map((name) => ({ recordKind: "training", requiredName: name, label: name, isMandatory: true }));
    await expect(createPromotionCriterion({ targetRankId: 4, minimumYearsOfService: 3, minimumTimeInGradeYears: 2, minimumPerformanceRating: 4, iperReviewPeriodMonths: 12, pftMinimumScore: 75, pftValidityMonths: 12, requirements })).resolves.toBe("c1");
    expect(rpc).toHaveBeenCalledWith("create_promotion_criterion", {
      target_rank_id: 4,
      target_minimum_years: 3,
      target_minimum_rating: 4,
      target_requirements: requirements,
      target_time_in_grade_years: 2,
      target_iper_period_months: 12,
      target_pft_minimum_score: 75,
      target_pft_validity_months: 12,
    });
  });

  it("submits only the validated employee docket RPC payload", async () => {
    const docketId = "123e4567-e89b-42d3-a456-426614174099";
    rpc.mockResolvedValue({ data: docketId, error: null });
    await expect(submitEmployeePromotionDocket({ criterionId: "123e4567-e89b-42d3-a456-426614174000", remarks: " Board-ready record " })).resolves.toBe(docketId);
    expect(rpc).toHaveBeenCalledWith("submit_employee_promotion_docket", {
      target_criterion_id: "123e4567-e89b-42d3-a456-426614174000",
      target_remarks: "Board-ready record",
    });
  });
});
