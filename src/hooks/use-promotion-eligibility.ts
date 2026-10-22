"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  decidePromotion,
  getMyPromotionStatus,
  getPromotionEvaluation,
  listPromotionCandidatesPage,
  listPromotionEmployees,
  listPromotionRankRequirements,
  promotionCandidateFilters,
  recordIperRating,
  recordPftResult,
} from "@/queries/promotion-eligibility";
import type { IperEntryInput, PftEntryInput, PromotionCandidateFilters, PromotionDecisionInput } from "@/schemas/promotion-eligibility";

export function usePromotionCandidates(input: Partial<PromotionCandidateFilters> = {}) {
  const filters = promotionCandidateFilters(input);
  return useQuery({ queryKey: queryKeys.promotionEligibility.candidates(filters), queryFn: () => listPromotionCandidatesPage(filters), placeholderData: keepPreviousData });
}
export function usePromotionEvaluation(employeeId: string | null) {
  return useQuery({ queryKey: queryKeys.promotionEligibility.evaluation(employeeId ?? ""), queryFn: () => getPromotionEvaluation(employeeId!), enabled: Boolean(employeeId) });
}
export function useMyPromotionStatus() { return useQuery({ queryKey: queryKeys.promotionEligibility.mine(), queryFn: getMyPromotionStatus }); }
export function usePromotionRankRequirements() { return useQuery({ queryKey: queryKeys.promotionEligibility.requirements(), queryFn: listPromotionRankRequirements, staleTime: 5 * 60_000 }); }
export function usePromotionEmployees(enabled = true) { return useQuery({ queryKey: queryKeys.promotionEligibility.employees(), queryFn: listPromotionEmployees, enabled }); }

/** Refreshes every view a promotion record feeds: scorecards, reports and the audit log. */
export function useInvalidatePromotion() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["promotion-eligibility"] });
    void client.invalidateQueries({ queryKey: ["reporting"] });
    void client.invalidateQueries({ queryKey: ["administration", "audit-logs"] });
  };
}
export function useDecidePromotion() { const invalidate = useInvalidatePromotion(); return useMutation({ mutationFn: (input: PromotionDecisionInput) => decidePromotion(input), onSuccess: invalidate }); }
export function useRecordIperRating() { const invalidate = useInvalidatePromotion(); return useMutation({ mutationFn: (input: IperEntryInput) => recordIperRating(input), onSuccess: invalidate }); }
export function useRecordPftResult() { const invalidate = useInvalidatePromotion(); return useMutation({ mutationFn: (input: PftEntryInput) => recordPftResult(input), onSuccess: invalidate }); }
