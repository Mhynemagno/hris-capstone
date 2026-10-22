import { z } from "zod";

import { isoDateSchema, paginationSchema, uuidSchema } from "./common";

/**
 * Promotion is evaluated by the system against fixed next-rank requirements
 * (20261022120000_promotion_auto_evaluation.sql). HR only approves or rejects,
 * and records the supervisor's IPER and the PFT result.
 */

export const IPER_RATINGS = ["Outstanding", "Very Satisfactory", "Satisfactory", "Unsatisfactory", "Poor"] as const;
export const iperRatingSchema = z.enum(IPER_RATINGS);
export const promotionStatusSchema = z.enum(["for_approval", "approved", "rejected"]);

const optionalNotes = z.string().trim().max(2000).nullish().transform((value) => value || null);

export const promotionCandidateFiltersSchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(25),
  status: promotionStatusSchema.optional(),
  employeeId: uuidSchema.optional(),
  search: z.string().trim().max(200).transform((value) => value || undefined).optional(),
});

export const promotionDecisionSchema = z.object({
  employeeId: uuidSchema,
  approve: z.boolean(),
  remarks: z.string().trim().max(2000).transform((value) => value || null).optional().default(null),
}).superRefine((value, context) => {
  if (!value.approve && !value.remarks) context.addIssue({ code: "custom", path: ["remarks"], message: "Enter the reason for rejecting this promotion." });
});

/** Supervisor's Individual Performance Evaluation Rating for a rating period of up to 6 months. */
export const iperEntrySchema = z.object({
  employeeId: uuidSchema,
  periodStartsOn: isoDateSchema,
  periodEndsOn: isoDateSchema,
  rating: iperRatingSchema,
  notes: optionalNotes,
}).superRefine((value, context) => {
  if (value.periodEndsOn < value.periodStartsOn) {
    context.addIssue({ code: "custom", path: ["periodEndsOn"], message: "The rating period must end on or after it starts." });
    return;
  }
  const limit = new Date(`${value.periodStartsOn}T00:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() + 6);
  if (value.periodEndsOn > limit.toISOString().slice(0, 10)) context.addIssue({ code: "custom", path: ["periodEndsOn"], message: "An IPER rating period covers at most 6 months." });
});

export const pftEntrySchema = z.object({
  employeeId: uuidSchema,
  assessedOn: isoDateSchema,
  passed: z.boolean(),
  notes: optionalNotes,
});

const rankRefSchema = z.object({ id: z.number().int(), code: z.string(), name: z.string() });

export const promotionEvaluationResultSchema = z.object({
  employeeId: uuidSchema,
  employeeName: z.string(),
  employeeNumber: z.string(),
  evaluatedOn: z.string(),
  isUniformed: z.boolean(),
  currentRank: rankRefSchema.nullable(),
  targetRank: rankRefSchema.nullable(),
  reason: z.enum(["no_rank", "non_uniformed", "top_rank", "inactive"]).nullable().optional().default(null),
  rankSince: z.string().optional(),
  timeInGradeMonths: z.number().int().optional(),
  minimumTimeInGradeMonths: z.number().int().optional(),
  trainings: z.array(z.object({
    name: z.string(),
    code: z.string(),
    met: z.boolean(),
    record: z.object({
      recordKind: z.enum(["certification", "training"]),
      recordId: uuidSchema,
      recordName: z.string(),
      completedOn: z.string(),
      documentPath: z.string().nullable(),
      documentName: z.string().nullable(),
    }).nullable(),
  })).optional(),
  eligibility: z.object({
    required: z.boolean(),
    record: z.object({ id: uuidSchema, name: z.string(), rating: z.string().nullable(), awardedOn: z.string(), documentPath: z.string().nullable(), documentName: z.string().nullable() }).nullable(),
  }).optional(),
  iper: z.object({
    minimum: iperRatingSchema,
    periodMonths: z.number().int(),
    record: z.object({ id: uuidSchema, rating: iperRatingSchema, periodStartsOn: z.string(), periodEndsOn: z.string() }).nullable(),
  }).optional(),
  pft: z.object({
    required: z.boolean(),
    validityMonths: z.number().int(),
    record: z.object({ id: uuidSchema, result: z.enum(["passed", "failed", "scored"]).nullable(), score: z.number().nullable(), assessedOn: z.string() }).nullable(),
  }).optional(),
  requirements: z.array(z.object({ key: z.string(), label: z.string(), met: z.boolean() })),
  missingRequirements: z.array(z.string()),
  isQualified: z.boolean(),
});

const decisionSummarySchema = z.object({
  id: uuidSchema,
  status: z.enum(["approved", "rejected"]),
  remarks: z.string().nullable(),
  decidedAt: z.string(),
  targetRankId: z.number().int(),
});

export const promotionEvaluationDetailSchema = z.object({
  evaluation: promotionEvaluationResultSchema,
  decision: decisionSummarySchema.nullable().optional().default(null),
});

export const myPromotionStatusSchema = z.object({
  evaluation: promotionEvaluationResultSchema,
  decision: decisionSummarySchema.nullable().optional().default(null),
  history: z.array(z.object({
    id: uuidSchema,
    status: z.enum(["approved", "rejected"]),
    remarks: z.string().nullable(),
    decidedAt: z.string(),
    targetRankCode: z.string(),
    targetRankName: z.string(),
  })).default([]),
});

export type PromotionCandidateFilters = z.infer<typeof promotionCandidateFiltersSchema>;
export type PromotionDecisionInput = z.input<typeof promotionDecisionSchema>;
export type IperEntryInput = z.input<typeof iperEntrySchema>;
export type PftEntryInput = z.input<typeof pftEntrySchema>;
