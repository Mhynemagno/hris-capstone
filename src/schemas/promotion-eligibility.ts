import { z } from "zod";

import { isoDateSchema, paginationSchema, uuidSchema } from "./common";

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null).optional().default(null);
const positiveInteger = z.coerce.number().int().positive();
const optionalRating = z.preprocess((value) => value === "" || value === undefined ? null : value, z.coerce.number().int().min(1).max(5).nullable());

export const promotionRecordKindSchema = z.enum(["qualification", "certification", "training"]);
export const promotionRecommendationSchema = z.enum(["recommended", "not_recommended", "deferred"]);
export const promotionReadinessSchema = z.enum(["ready", "not_ready"]);

export const promotionCriterionRequirementSchema = z.object({
  id: uuidSchema.optional(),
  recordKind: promotionRecordKindSchema,
  requiredName: z.string().trim().min(1, "A required record name is required.").max(200),
  label: z.string().trim().min(1, "A requirement label is required.").max(200),
  isMandatory: z.boolean().default(true),
});

export const promotionCriterionSchema = z.object({
  targetPositionId: positiveInteger,
  minimumYearsOfService: z.coerce.number().int().min(0).max(100),
  minimumPerformanceRating: optionalRating,
  requirements: z.array(promotionCriterionRequirementSchema).max(30).default([]),
});

export const promotionCriterionUpdateSchema = promotionCriterionSchema.extend({
  id: uuidSchema,
  isActive: z.boolean(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export const performanceRatingSchema = z.object({
  employeeId: uuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  reviewPeriodStartsOn: isoDateSchema,
  reviewPeriodEndsOn: isoDateSchema,
  notes: optionalText(2000),
}).superRefine((value, context) => {
  if (value.reviewPeriodEndsOn < value.reviewPeriodStartsOn) context.addIssue({ code: "custom", path: ["reviewPeriodEndsOn"], message: "Review period end must be on or after its start." });
});

export const performanceRatingUpdateSchema = performanceRatingSchema.extend({
  id: uuidSchema,
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export const promotionEvidenceSchema = z.object({
  requirementId: uuidSchema,
  qualificationId: uuidSchema.optional(),
  certificationId: uuidSchema.optional(),
  trainingRecordId: uuidSchema.optional(),
}).superRefine((value, context) => {
  if ([value.qualificationId, value.certificationId, value.trainingRecordId].filter(Boolean).length !== 1) context.addIssue({ code: "custom", message: "Link exactly one personnel record as evidence." });
});

export const promotionEvaluationSchema = z.object({
  employeeId: uuidSchema,
  targetPositionId: positiveInteger,
  criterionId: uuidSchema,
  evaluatedOn: isoDateSchema,
  recommendation: promotionRecommendationSchema,
  notes: optionalText(2000),
  evidence: z.array(promotionEvidenceSchema).max(30).default([]),
});

export const promotionEvaluationUpdateSchema = promotionEvaluationSchema.extend({
  id: uuidSchema,
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export const promotionEvaluationFiltersSchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(25),
  employeeId: uuidSchema.optional(),
  targetPositionId: positiveInteger.optional(),
  readiness: promotionReadinessSchema.optional(),
  recommendation: promotionRecommendationSchema.optional(),
  search: z.string().trim().max(200).transform((value) => value || undefined).optional(),
});

export const employeePromotionEligibilitySchema = z.object({
  employeeId: uuidSchema,
  evaluationId: uuidSchema,
  targetPositionId: positiveInteger,
  targetPositionTitle: z.string(),
  calculatedAt: z.string().datetime({ offset: true }),
  yearsOfService: z.number().int().min(0),
  isReady: z.boolean(),
  missingRequirements: z.array(z.string()),
});

export type PromotionRecordKind = z.infer<typeof promotionRecordKindSchema>;
export type PromotionRecommendation = z.infer<typeof promotionRecommendationSchema>;
export type PromotionCriterionInput = z.infer<typeof promotionCriterionSchema>;
export type PromotionCriterionUpdateInput = z.infer<typeof promotionCriterionUpdateSchema>;
export type PerformanceRatingInput = z.infer<typeof performanceRatingSchema>;
export type PerformanceRatingUpdateInput = z.infer<typeof performanceRatingUpdateSchema>;
export type PromotionEvidenceInput = z.infer<typeof promotionEvidenceSchema>;
export type PromotionEvaluationInput = z.infer<typeof promotionEvaluationSchema>;
export type PromotionEvaluationUpdateInput = z.infer<typeof promotionEvaluationUpdateSchema>;
export type PromotionEvaluationFilters = z.infer<typeof promotionEvaluationFiltersSchema>;
