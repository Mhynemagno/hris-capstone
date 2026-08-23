import { describe, expect, it } from "vitest";

import {
  performanceRatingSchema,
  promotionCriterionSchema,
  promotionEvaluationFiltersSchema,
} from "./promotion-eligibility";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

describe("promotion eligibility schemas", () => {
  it("normalizes target-position criteria and record requirements", () => {
    expect(promotionCriterionSchema.parse({
      targetPositionId: "4",
      minimumYearsOfService: "3",
      minimumPerformanceRating: "4",
      requirements: [{ recordKind: "certification", requiredName: " First Aid ", label: " First-aid certification ", isMandatory: true }],
    })).toEqual({
      targetPositionId: 4,
      minimumYearsOfService: 3,
      minimumPerformanceRating: 4,
      requirements: [{ recordKind: "certification", requiredName: "First Aid", label: "First-aid certification", isMandatory: true }],
    });
  });

  it("rejects invalid rating periods and unsupported requirement kinds", () => {
    expect(performanceRatingSchema.safeParse({ employeeId, rating: 6, reviewPeriodStartsOn: "2026-07-01", reviewPeriodEndsOn: "2026-06-30" }).success).toBe(false);
    expect(promotionCriterionSchema.safeParse({ targetPositionId: 4, minimumYearsOfService: -1, requirements: [{ recordKind: "deployment", requiredName: "x", label: "x", isMandatory: true }] }).success).toBe(false);
  });

  it("bounds page size while normalizing directory filters", () => {
    expect(promotionEvaluationFiltersSchema.parse({ page: "2", pageSize: "200", readiness: "ready", recommendation: "recommended" })).toEqual({ page: 2, pageSize: 100, readiness: "ready", recommendation: "recommended" });
  });
});
