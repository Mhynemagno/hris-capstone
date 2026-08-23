import { z } from "zod";

import { isoDateSchema, uuidSchema } from "./common";

const profileChangeStatuses = ["pending", "approved", "rejected", "cancelled"] as const;
const contactFields = [
  "personalEmail",
  "phone",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;
const documentMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();
const nullableText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable();

export const profileChangeQualificationSnapshotSchema = z.object({
  name: z.string().trim().min(2).max(160),
  institution: z.string().trim().min(2).max(160),
  qualificationLevel: nullableText(80),
  fieldOfStudy: nullableText(160),
  awardedOn: isoDateSchema,
  notes: nullableText(2000),
});

export const profileChangeContactChangeSchema = z.object({
  kind: z.literal("contact"),
  field: z.enum(contactFields),
  originalValue: nullableText(500),
  requestedValue: nullableText(500),
}).superRefine((value, context) => {
  if (value.field === "personalEmail" && value.requestedValue !== null && !z.email().safeParse(value.requestedValue).success) {
    context.addIssue({ code: "custom", path: ["requestedValue"], message: "Enter a valid personal email address." });
  }
});

const qualificationAddChangeSchema = z.object({
  kind: z.literal("qualification"),
  operation: z.literal("add"),
  originalValue: z.null(),
  requestedValue: profileChangeQualificationSnapshotSchema,
});

const qualificationEditChangeSchema = z.object({
  kind: z.literal("qualification"),
  operation: z.literal("edit"),
  qualificationId: uuidSchema,
  originalValue: profileChangeQualificationSnapshotSchema,
  requestedValue: profileChangeQualificationSnapshotSchema,
});

const qualificationRemoveChangeSchema = z.object({
  kind: z.literal("qualification"),
  operation: z.literal("remove"),
  qualificationId: uuidSchema,
  originalValue: profileChangeQualificationSnapshotSchema,
  requestedValue: z.null(),
});

export const profileChangeQualificationChangeSchema = z.union([
  qualificationAddChangeSchema,
  qualificationEditChangeSchema,
  qualificationRemoveChangeSchema,
]);

export const profileChangeChangeSchema = z.union([
  profileChangeContactChangeSchema,
  profileChangeQualificationChangeSchema,
]);

export const profileChangeDocumentSchema = z.object({
  objectPath: z.string().regex(
    /^profile-change-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|png|jpe?g|webp)$/i,
    "Use a private profile-change request document path.",
  ),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(documentMimeTypes),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

export const profileChangeDraftSchema = z.object({
  note: optionalText(2000),
  changes: z.array(profileChangeChangeSchema).min(1).max(20),
});

export const profileChangeSubmissionSchema = profileChangeDraftSchema.extend({
  requestId: uuidSchema,
  documents: z.array(profileChangeDocumentSchema).max(10),
});

export const profileChangeDecisionSchema = z.object({
  requestId: uuidSchema,
  decision: z.enum(["approved", "rejected"]),
  reason: optionalText(2000),
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Provide a reason when rejecting a request." });
  }
});

export const profileChangeCancellationSchema = z.object({ requestId: uuidSchema });

export const profileChangeRequestFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(20),
  status: z.enum(profileChangeStatuses).optional(),
  search: optionalText(120),
});

export type ProfileChangeDraftInput = z.infer<typeof profileChangeDraftSchema>;
export type ProfileChangeSubmissionInput = z.infer<typeof profileChangeSubmissionSchema>;
export type ProfileChangeDecisionInput = z.infer<typeof profileChangeDecisionSchema>;
export type ProfileChangeCancellationInput = z.infer<typeof profileChangeCancellationSchema>;
export type ProfileChangeRequestFilters = z.infer<typeof profileChangeRequestFiltersSchema>;
export type ProfileChangeStatus = (typeof profileChangeStatuses)[number];
