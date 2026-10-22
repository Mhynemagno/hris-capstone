import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { uuidSchema } from "@/schemas/common";
import { promotionAssignmentInputSchema, promotionAwardInputSchema, promotionBoardAssessmentInputSchema } from "@/schemas/promotion-scorecard";

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }

/** HR: a verified assignment period. The database derives its points from the fixed PDF policy. */
export async function recordPromotionAssignment(input: unknown) {
  const value = promotionAssignmentInputSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("record_promotion_assignment", {
    target_employee_id: value.employeeId,
    target_kind: value.kind,
    target_region: value.region,
    target_starts_on: value.startedOn,
    target_ends_on: value.endedOn,
    target_evidence: value.evidence,
  });
  throwIfError(error);
  return uuidSchema.parse(data);
}

/** HR: a policy award held at the employee's present rank. */
export async function recordPromotionAward(input: unknown) {
  const value = promotionAwardInputSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("record_promotion_award", {
    target_employee_id: value.employeeId,
    target_award_key: value.awardKey,
    target_awarded_on: value.awardedOn,
    target_present_rank_id: value.presentRankId,
    target_evidence: value.evidence,
  });
  throwIfError(error);
  return uuidSchema.parse(data);
}

/** HR: a Promotion Board interview/leadership or service-reputation score, bounded by the policy maximum. */
export async function recordPromotionBoardAssessment(input: unknown) {
  const value = promotionBoardAssessmentInputSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("record_promotion_board_assessment", {
    target_employee_id: value.employeeId,
    target_criterion: value.criterion,
    target_band: value.band,
    target_assessed_on: value.assessedOn,
    target_score: value.score,
    target_evidence: value.evidence,
  });
  throwIfError(error);
  return uuidSchema.parse(data);
}
