import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ rpc }),
}));

import { createPromotionCriterion, promotionEvaluationFilters } from "./promotion-eligibility";

describe("promotion eligibility queries", () => {
  it("normalizes bounded HR directory filters before requesting data", () => {
    expect(promotionEvaluationFilters({ page: "2", pageSize: "200", readiness: "ready", recommendation: "recommended" })).toEqual({
      page: 2,
      pageSize: 100,
      readiness: "ready",
      recommendation: "recommended",
    });
  });

  it("creates criteria with several training requirements and no rating minimum", async () => {
    rpc.mockResolvedValue({ data: "c1", error: null });
    const requirements = ["PSJLC", "PSOAC"].map((name) => ({ recordKind: "training", requiredName: name, label: name, isMandatory: true }));
    await expect(createPromotionCriterion({ targetRankId: 4, minimumYearsOfService: 3, minimumPerformanceRating: 4, requirements })).resolves.toBe("c1");
    expect(rpc).toHaveBeenCalledWith("create_promotion_criterion", {
      target_rank_id: 4,
      target_minimum_years: 3,
      target_minimum_rating: null,
      target_requirements: requirements,
    });
  });
});
