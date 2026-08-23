"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createPerformanceRating, createPromotionCriterion, createPromotionEvaluation, getHrPromotionEmployee, getMyPromotionEligibility, listPromotionCriteria, listPromotionEvaluations, promotionEvaluationFilters, updatePerformanceRating, updatePromotionCriterion, updatePromotionEvaluation } from "@/queries/promotion-eligibility";
import type { PromotionEvaluationFilters } from "@/schemas/promotion-eligibility";
export function usePromotionCriteria(input: { isActive?: boolean } = {}) { return useQuery({ queryKey: queryKeys.promotionEligibility.criteria(input), queryFn: () => listPromotionCriteria(input) }); }
export function usePromotionEvaluations(input: Partial<PromotionEvaluationFilters> = {}) { const filters = promotionEvaluationFilters(input); return useQuery({ queryKey: queryKeys.promotionEligibility.hrDirectory(filters), queryFn: () => listPromotionEvaluations(filters) }); }
export function useHrPromotionEmployee(id: string) { return useQuery({ queryKey: queryKeys.promotionEligibility.hrEmployee(id), queryFn: () => getHrPromotionEmployee(id), enabled: Boolean(id) }); }
export function useMyPromotionEligibility() { return useQuery({ queryKey: queryKeys.promotionEligibility.mine(), queryFn: getMyPromotionEligibility }); }
function useInvalidate() { const client = useQueryClient(); return () => { void client.invalidateQueries({ queryKey: ["promotion-eligibility"] }); void client.invalidateQueries({ queryKey: ["reporting"] }); void client.invalidateQueries({ queryKey: ["administration", "audit-logs"] }); }; }
export function useCreatePromotionCriterion() { const invalidate = useInvalidate(); return useMutation({ mutationFn: createPromotionCriterion, onSuccess: invalidate }); }
export function useUpdatePromotionCriterion() { const invalidate = useInvalidate(); return useMutation({ mutationFn: updatePromotionCriterion, onSuccess: invalidate }); }
export function useCreatePerformanceRating() { const invalidate = useInvalidate(); return useMutation({ mutationFn: createPerformanceRating, onSuccess: invalidate }); }
export function useUpdatePerformanceRating() { const invalidate = useInvalidate(); return useMutation({ mutationFn: updatePerformanceRating, onSuccess: invalidate }); }
export function useCreatePromotionEvaluation() { const invalidate = useInvalidate(); return useMutation({ mutationFn: createPromotionEvaluation, onSuccess: invalidate }); }
export function useUpdatePromotionEvaluation() { const invalidate = useInvalidate(); return useMutation({ mutationFn: updatePromotionEvaluation, onSuccess: invalidate }); }
