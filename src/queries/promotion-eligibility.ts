import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MyPromotionStatus, PaginatedResult, PromotionCandidateRow, PromotionEvaluationDetail, PromotionRankRequirement } from "@/lib/types/database";
import { uuidSchema } from "@/schemas/common";
import {
  iperEntrySchema,
  myPromotionStatusSchema,
  pftEntrySchema,
  promotionCandidateFiltersSchema,
  promotionDecisionSchema,
  promotionEvaluationDetailSchema,
  type PromotionCandidateFilters,
} from "@/schemas/promotion-eligibility";

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }

export function promotionCandidateFilters(input: unknown = {}) { return promotionCandidateFiltersSchema.parse(input); }

/** HR dashboard: qualified personnel for approval plus decided promotions, evaluated by the system. */
export async function listPromotionCandidatesPage(input: Partial<PromotionCandidateFilters> = {}): Promise<PaginatedResult<PromotionCandidateRow, PromotionCandidateFilters>> {
  const filters = promotionCandidateFilters(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("list_promotion_candidates_page", {
    target_search: filters.search ?? null,
    target_status: filters.status ?? null,
    target_page: filters.page,
    target_page_size: filters.pageSize,
    target_employee_id: filters.employeeId ?? null,
  });
  throwIfError(error);
  const rows = (data ?? []) as PromotionCandidateRow[];
  return { rows, count: Number(rows[0]?.total_count ?? 0), filters };
}

/** HR: one employee's next-rank checklist and the recorded decision, if any. */
export async function getPromotionEvaluation(employeeId: string): Promise<PromotionEvaluationDetail | null> {
  const { data, error } = await createBrowserSupabaseClient().rpc("get_promotion_evaluation", { target_employee_id: uuidSchema.parse(employeeId) });
  throwIfError(error);
  return data === null ? null : promotionEvaluationDetailSchema.parse(data) as PromotionEvaluationDetail;
}

/** The signed-in employee's next-rank checklist and HR decision. */
export async function getMyPromotionStatus(): Promise<MyPromotionStatus | null> {
  const { data, error } = await createBrowserSupabaseClient().rpc("get_my_promotion_status");
  throwIfError(error);
  return data === null ? null : myPromotionStatusSchema.parse(data) as MyPromotionStatus;
}

/** Read-only system requirements per target rank. */
export async function listPromotionRankRequirements() {
  const { data, error } = await createBrowserSupabaseClient().from("promotion_rank_requirements").select("*");
  throwIfError(error);
  return (data ?? []) as PromotionRankRequirement[];
}

/** Active personnel for the IPER / PFT entry picker. */
export async function listPromotionEmployees() {
  const { data, error } = await createBrowserSupabaseClient().from("employees").select("id, employee_number, first_name, last_name").eq("employment_status", "active").order("last_name");
  throwIfError(error);
  return (data ?? []) as { id: string; employee_number: string; first_name: string; last_name: string }[];
}

export async function decidePromotion(input: unknown) {
  const value = promotionDecisionSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("decide_promotion", { target_employee_id: value.employeeId, target_approve: value.approve, target_remarks: value.remarks });
  throwIfError(error);
  return uuidSchema.parse(data);
}

export async function recordIperRating(input: unknown) {
  const value = iperEntrySchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("record_iper_rating", { target_employee_id: value.employeeId, target_starts_on: value.periodStartsOn, target_ends_on: value.periodEndsOn, target_rating: value.rating, target_notes: value.notes });
  throwIfError(error);
  return uuidSchema.parse(data);
}

export async function recordPftResult(input: unknown) {
  const value = pftEntrySchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("record_pft_result", { target_employee_id: value.employeeId, target_assessed_on: value.assessedOn, target_passed: value.passed, target_notes: value.notes });
  throwIfError(error);
  return uuidSchema.parse(data);
}
