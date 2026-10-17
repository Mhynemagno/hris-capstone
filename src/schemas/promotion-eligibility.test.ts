import { describe, expect, it } from "vitest";

import {
  performanceRatingSchema,
  promotionCriterionSchema,
  promotionDocketSchema,
  promotionEvaluationFiltersSchema,
} from "./promotion-eligibility";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

describe("promotion eligibility schemas", () => {
  it("normalizes target-rank criteria and record requirements", () => {
    expect(promotionCriterionSchema.parse({
      targetRankId: "4",
      minimumYearsOfService: "3",
      minimumTimeInGradeYears: "2",
      minimumPerformanceRating: "4",
      iperReviewPeriodMonths: "12",
      pftMinimumScore: "75",
      pftValidityMonths: "12",
      requirements: [{ recordKind: "certification", requiredName: " First Aid ", label: " First-aid certification ", isMandatory: true }],
    })).toEqual({
      targetRankId: 4,
      minimumYearsOfService: 3,
      minimumTimeInGradeYears: 2,
      minimumPerformanceRating: 4,
      iperReviewPeriodMonths: 12,
      pftMinimumScore: 75,
      pftValidityMonths: 12,
      requirements: [{ recordKind: "certification", requiredName: "First Aid", label: "First-aid certification", isMandatory: true }],
    });
  });

  it("rejects invalid rating periods and unsupported requirement kinds", () => {
    expect(performanceRatingSchema.safeParse({ employeeId, rating: 6, reviewPeriodStartsOn: "2026-07-01", reviewPeriodEndsOn: "2026-06-30" }).success).toBe(false);
    expect(promotionCriterionSchema.safeParse({ targetRankId: 4, minimumYearsOfService: -1, requirements: [{ recordKind: "deployment", requiredName: "x", label: "x", isMandatory: true }] }).success).toBe(false);
  });

  it.each([0, 31, 100])("rejects %i years of service for a criterion", (minimumYearsOfService) => {
    expect(promotionCriterionSchema.safeParse({ targetRankId: 4, minimumYearsOfService, requirements: [{ recordKind: "training", requiredName: "PSJLC", label: "PSJLC", isMandatory: true }] }).success).toBe(false);
  });

  it("allows optional courses, rejects duplicates, and keeps evaluation groups paired", () => {
    const training = (name: string) => ({ recordKind: "training", requiredName: name, label: name, isMandatory: true });
    const base = { targetRankId: 4, minimumYearsOfService: 3 };
    expect(promotionCriterionSchema.safeParse({ ...base, requirements: [] }).success).toBe(true);
    expect(promotionCriterionSchema.safeParse(base).success).toBe(false);
    expect(promotionCriterionSchema.safeParse({ ...base, requirements: [training("PSJLC"), training(" psjlc ")] }).error?.issues[0]?.message).toBe("Each requirement can only be added once.");
    expect(promotionCriterionSchema.safeParse({ ...base, requirements: [training("")] }).error?.issues[0]?.message).toBe("Choose a requirement.");
    expect(promotionCriterionSchema.parse({ ...base, requirements: [training("PSJLC"), training("PSOAC")] })).toMatchObject({ minimumPerformanceRating: null, requirements: [{ requiredName: "PSJLC" }, { requiredName: "PSOAC" }] });
    expect(promotionCriterionSchema.safeParse({ ...base, minimumPerformanceRating: 4, requirements: [] }).success).toBe(false);
    expect(promotionCriterionSchema.safeParse({ ...base, pftMinimumScore: 75, requirements: [] }).success).toBe(false);
  });

  it("bounds page size while normalizing directory filters", () => {
    expect(promotionEvaluationFiltersSchema.parse({ page: "2", pageSize: "200", readiness: "ready", recommendation: "recommended" })).toEqual({ page: 2, pageSize: 100, readiness: "ready", recommendation: "recommended" });
  });

  it("requires substantive, trimmed remarks for an employee promotion docket", () => {
    expect(promotionDocketSchema.safeParse({ criterionId: employeeId, remarks: "  " }).success).toBe(false);
    expect(promotionDocketSchema.parse({ criterionId: employeeId, remarks: "  Board-ready record  " })).toEqual({ criterionId: employeeId, remarks: "Board-ready record" });
  });
});
