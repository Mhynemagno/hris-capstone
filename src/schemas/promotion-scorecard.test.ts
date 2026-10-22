import { describe, expect, it } from "vitest";

import { promotionAssignmentInputSchema, promotionAwardInputSchema, promotionBoardAssessmentInputSchema } from "./promotion-scorecard";

const employeeId = "00000000-0000-4000-8000-000000012301";

describe("promotion scorecard evidence schemas", () => {
  it("rejects inverted assignment dates and unknown geographical regions", () => {
    expect(() => promotionAssignmentInputSchema.parse({ employeeId, kind: "field_or_quad", startedOn: "2026-10-02", endedOn: "2026-10-01", region: null, evidence: "verified" })).toThrow("end on or after");
    expect(() => promotionAssignmentInputSchema.parse({ employeeId, kind: "geographic", startedOn: "2026-01-01", endedOn: "2026-07-01", region: "Outside policy", evidence: "verified" })).toThrow();
  });

  it("accepts only policy award keys", () => {
    expect(() => promotionAwardInputSchema.parse({ employeeId, awardKey: "unknown_award", awardedOn: "2026-01-01", presentRankCode: "PCPL", evidence: "certificate" })).toThrow();
    expect(promotionAwardInputSchema.parse({ employeeId, awardKey: "medalya_ng_kagitingan", awardedOn: "2026-01-01", presentRankCode: "PCPL", evidence: "certificate" }).awardKey).toBe("medalya_ng_kagitingan");
  });

  it("rejects scores outside a board criterion maximum without trusting the browser", () => {
    expect(() => promotionBoardAssessmentInputSchema.parse({ employeeId, criterion: "board", band: "PCPL-PMSG", assessedOn: "2026-01-01", score: 15.1, evidence: "panel sheet" })).toThrow();
    expect(promotionBoardAssessmentInputSchema.parse({ employeeId, criterion: "reputation", band: "PCPL-PMSG", assessedOn: "2026-01-01", score: 20, evidence: "records review" }).score).toBe(20);
  });
});
