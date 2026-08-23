import { z } from "zod";

import { isoDateSchema, paginationSchema, uuidSchema } from "./common";

const maxAttachmentSizeBytes = 10 * 1024 * 1024;
const acceptedAttachmentMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
const leaveStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
const leaveTypeNameSchema = z.string().trim().min(1).max(100);
const optionalDescriptionSchema = z.string().trim().max(2000).transform((value) => value || null).optional();
const requestReasonSchema = z.string().trim().min(1).max(2000);
const optionalDecisionNoteSchema = z.string().trim().max(2000).transform((value) => value || undefined).optional();

function todayIsoDate() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function futureOrCurrentDate(value: string) {
  return value >= todayIsoDate();
}

export const leaveTypeSchema = z.object({
  name: leaveTypeNameSchema,
  description: optionalDescriptionSchema,
  requiresAttachment: z.boolean().default(false),
});

export const leaveTypeUpdateSchema = leaveTypeSchema.extend({
  id: uuidSchema,
  isActive: z.boolean(),
});

export const leaveAttachmentSchema = z.object({
  objectPath: z.string().regex(
    /^leave-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/i,
    "Use a leave request private-document path.",
  ),
  fileName: z.string().trim().min(1).max(255).regex(/^[^\\/\u0000]+$/, "Use a safe file name."),
  mimeType: z.enum(acceptedAttachmentMimeTypes),
  sizeBytes: z.number().int().positive().max(maxAttachmentSizeBytes),
});

export const leaveRequestDraftSchema = z.object({
  leaveTypeId: uuidSchema,
  startsOn: isoDateSchema.refine(futureOrCurrentDate, "Choose today or a future start date."),
  endsOn: isoDateSchema.refine(futureOrCurrentDate, "Choose today or a future end date."),
  reason: requestReasonSchema,
}).superRefine((value, context) => {
  if (value.endsOn < value.startsOn) {
    context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after the start date." });
  }
});

export const leaveRequestSubmissionSchema = leaveRequestDraftSchema.extend({
  requestId: uuidSchema,
  attachments: z.array(leaveAttachmentSchema).max(10),
});

export const leaveCancellationSchema = z.object({ requestId: uuidSchema });

export const leaveDecisionSchema = z.object({
  requestId: uuidSchema,
  decision: z.enum(["approved", "rejected"]),
  note: optionalDecisionNoteSchema,
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Provide a reason when rejecting a leave request." });
  }
});

export const leaveRequestFiltersSchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(25),
  status: leaveStatusSchema.optional(),
  leaveTypeId: uuidSchema.optional(),
  search: z.string().trim().max(200).transform((value) => value || undefined).optional(),
  startsOn: isoDateSchema.optional(),
  endsOn: isoDateSchema.optional(),
});

export type LeaveRequestStatus = z.infer<typeof leaveStatusSchema>;
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
export type LeaveTypeUpdateInput = z.infer<typeof leaveTypeUpdateSchema>;
export type LeaveAttachmentInput = z.infer<typeof leaveAttachmentSchema>;
export type LeaveRequestDraftInput = z.infer<typeof leaveRequestDraftSchema>;
export type LeaveRequestSubmissionInput = z.infer<typeof leaveRequestSubmissionSchema>;
export type LeaveCancellationInput = z.infer<typeof leaveCancellationSchema>;
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;
export type LeaveRequestFilters = z.infer<typeof leaveRequestFiltersSchema>;
