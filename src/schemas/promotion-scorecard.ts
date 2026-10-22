import { z } from "zod";

import { PROMOTION_SCORECARD_POLICIES, type PromotionScoreBand } from "@/lib/promotion-policies";

import { isoDateSchema, uuidSchema } from "./common";

const scoreBands = ["PCPL-PMSG", "PSMS-PEMS", "PLT-PLTCOL"] as const satisfies readonly PromotionScoreBand[];
const assignmentKinds = ["field_or_quad", "administrative", "geographic"] as const;
const regions = ["Luzon", "Visayas", "Mindanao"] as const;
const boardCriteria = ["board", "reputation"] as const;
const policyAwardKeys = new Set(Object.values(PROMOTION_SCORECARD_POLICIES).flatMap((policy) => policy.awards.map((award) => award.key)));
const evidenceSchema = z.string().trim().min(1, "Enter the supporting evidence.").max(2000);

export const promotionAssignmentInputSchema = z.object({
  employeeId: uuidSchema,
  kind: z.enum(assignmentKinds),
  startedOn: isoDateSchema,
  endedOn: isoDateSchema,
  region: z.enum(regions).nullable(),
  evidence: evidenceSchema,
}).superRefine((value, context) => {
  if (value.endedOn < value.startedOn) context.addIssue({ code: "custom", path: ["endedOn"], message: "The assignment must end on or after it starts." });
  if (value.kind === "geographic" && !value.region) context.addIssue({ code: "custom", path: ["region"], message: "Choose the geographical assignment region." });
  if (value.kind !== "geographic" && value.region) context.addIssue({ code: "custom", path: ["region"], message: "Only geographical assignments have a region." });
});

export const promotionAwardInputSchema = z.object({
  employeeId: uuidSchema,
  awardKey: z.string().refine((value) => policyAwardKeys.has(value), "Choose an official promotion-policy award."),
  awardedOn: isoDateSchema,
  presentRankCode: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  evidence: evidenceSchema,
});

export const promotionBoardAssessmentInputSchema = z.object({
  employeeId: uuidSchema,
  criterion: z.enum(boardCriteria),
  band: z.enum(scoreBands),
  assessedOn: isoDateSchema,
  score: z.coerce.number().finite().min(0),
  evidence: evidenceSchema,
}).superRefine((value, context) => {
  const maximum = PROMOTION_SCORECARD_POLICIES[value.band].allocation[value.criterion];
  if (value.score > maximum) context.addIssue({ code: "custom", path: ["score"], message: `The score cannot exceed ${maximum} points for this criterion.` });
});

export type PromotionAssignmentInput = z.input<typeof promotionAssignmentInputSchema>;
export type PromotionAwardInput = z.input<typeof promotionAwardInputSchema>;
export type PromotionBoardAssessmentInput = z.input<typeof promotionBoardAssessmentInputSchema>;
