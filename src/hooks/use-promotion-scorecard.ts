"use client";
import { useMutation } from "@tanstack/react-query";

import { useInvalidatePromotion } from "@/hooks/use-promotion-eligibility";
import { recordPromotionAssignment, recordPromotionAward, recordPromotionBoardAssessment } from "@/queries/promotion-scorecard";
import type { PromotionAssignmentInput, PromotionAwardInput, PromotionBoardAssessmentInput } from "@/schemas/promotion-scorecard";

export function useRecordPromotionAssignment() { const invalidate = useInvalidatePromotion(); return useMutation({ mutationFn: (input: PromotionAssignmentInput) => recordPromotionAssignment(input), onSuccess: invalidate }); }
export function useRecordPromotionAward() { const invalidate = useInvalidatePromotion(); return useMutation({ mutationFn: (input: PromotionAwardInput) => recordPromotionAward(input), onSuccess: invalidate }); }
export function useRecordPromotionBoardAssessment() { const invalidate = useInvalidatePromotion(); return useMutation({ mutationFn: (input: PromotionBoardAssessmentInput) => recordPromotionBoardAssessment(input), onSuccess: invalidate }); }
