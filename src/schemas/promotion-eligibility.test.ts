import { describe, expect, it } from "vitest";

import { iperEntrySchema, myPromotionStatusSchema, pftEntrySchema, promotionCandidateFiltersSchema, promotionDecisionSchema, promotionEvaluationResultSchema } from "./promotion-eligibility";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

describe("promotion schemas", () => {
  it("bounds dashboard filters and accepts only known statuses", () => {
    expect(promotionCandidateFiltersSchema.parse({ page: "2", pageSize: "500", status: "approved" })).toEqual({ page: 2, pageSize: 100, status: "approved" });
    expect(promotionCandidateFiltersSchema.safeParse({ status: "pending" }).success).toBe(false);
  });

  it("requires a reason to reject but not to approve", () => {
    expect(promotionDecisionSchema.safeParse({ employeeId, approve: false, remarks: "  " }).error?.issues[0]?.message).toBe("Enter the reason for rejecting this promotion.");
    expect(promotionDecisionSchema.parse({ employeeId, approve: true })).toEqual({ employeeId, approve: true, remarks: null });
    expect(promotionDecisionSchema.parse({ employeeId, approve: false, remarks: " Lacks PSJLC " })).toEqual({ employeeId, approve: false, remarks: "Lacks PSJLC" });
  });

  it("accepts adjectival IPER ratings for up to 6 months", () => {
    expect(iperEntrySchema.safeParse({ employeeId, periodStartsOn: "2026-01-01", periodEndsOn: "2026-07-01", rating: "Satisfactory" }).success).toBe(true);
    expect(iperEntrySchema.safeParse({ employeeId, periodStartsOn: "2026-01-01", periodEndsOn: "2026-07-02", rating: "Satisfactory" }).error?.issues[0]?.message).toBe("An IPER rating period covers at most 6 months.");
    expect(iperEntrySchema.safeParse({ employeeId, periodStartsOn: "2026-01-01", periodEndsOn: "2026-06-30", rating: "4" }).success).toBe(false);
    expect(iperEntrySchema.safeParse({ employeeId, periodStartsOn: "2026-06-30", periodEndsOn: "2026-01-01", rating: "Poor" }).error?.issues[0]?.message).toBe("The rating period must end on or after it starts.");
  });

  it("records PFT as passed or failed", () => {
    expect(pftEntrySchema.parse({ employeeId, assessedOn: "2026-09-01", passed: false })).toEqual({ employeeId, assessedOn: "2026-09-01", passed: false, notes: null });
    expect(pftEntrySchema.safeParse({ employeeId, assessedOn: "2026-09-01" }).success).toBe(false);
  });

  it("parses the employee status with a top-rank evaluation", () => {
    const parsed = myPromotionStatusSchema.parse({
      evaluation: { employeeId, employeeName: "Cruz, Ana", employeeNumber: "1-23456", evaluatedOn: "2026-10-22", isUniformed: true, currentRank: { id: 12, code: "PCOL", name: "Police Colonel" }, targetRank: null, reason: "top_rank", requirements: [], missingRequirements: [], isQualified: false },
      decision: null,
    });
    expect(parsed.history).toEqual([]);
    expect(parsed.evaluation.reason).toBe("top_rank");
  });

  it("preserves PDF scorecard totals and unassessed criterion state", () => {
    const parsed = promotionEvaluationResultSchema.parse({
      employeeId, employeeName: "Cruz, Ana", employeeNumber: "1-23456", evaluatedOn: "2026-10-22", isUniformed: true,
      currentRank: { id: 2, code: "PCPL", name: "Police Corporal" }, targetRank: { id: 3, code: "PSSG", name: "Police Staff Sergeant" },
      band: "PCPL-PMSG", totalScore: 63.5, maximumScore: 100, eligibility: { record: { id: employeeId, name: "NAPOLCOM", rating: "84%", awardedOn: "2026-01-01", documentPath: null, documentName: null } },
      criteria: [{ key: "board", label: "Interview", points: 0, maximumPoints: 15, state: "unassessed", evidence: null }],
    });
    expect(parsed.totalScore).toBe(63.5);
    expect(parsed.criteria?.[0]).toMatchObject({ maximumPoints: 15, state: "unassessed" });
  });

  it("accepts the employee's own scorecard, whose criteria omit HR evidence", () => {
    const parsed = myPromotionStatusSchema.parse({
      evaluation: {
        employeeId, employeeName: "Cruz, Ana", employeeNumber: "1-23456", evaluatedOn: "2026-10-22", isUniformed: true,
        currentRank: { id: 2, code: "PCPL", name: "Police Corporal" }, targetRank: { id: 3, code: "PSSG", name: "Police Staff Sergeant" },
        band: "PCPL-PMSG", totalScore: 30, maximumScore: 100, eligibility: { record: null },
        criteria: [{ key: "reputation", label: "Service reputation", points: 0, maximumPoints: 20, state: "unassessed" }],
      },
      decision: null,
      history: [],
    });
    expect(parsed.evaluation.criteria?.[0]).not.toHaveProperty("evidence");
  });
});
