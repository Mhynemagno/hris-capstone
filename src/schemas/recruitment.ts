import { z } from "zod";

import { employeeNumberSchema, isoDateSchema, paginationSchema, uuidSchema } from "./common";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

const positiveInteger = z.coerce.number().int().positive();

export const applicationStatusSchema = z.enum([
  "Submitted",
  "Under Review",
  "Shortlisted",
  "Interview",
  "Hired",
  "Not Selected",
]);

export const jobOpeningStatusSchema = z.enum(["draft", "published", "closed"]);
export const jobCriterionKindSchema = z.enum([
  "education",
  "experience",
  "skill",
  "certification",
  "other",
]);
export const applicantDocumentKindSchema = z.enum(["cv", "credential"]);
export const applicationAiStatusSchema = z.enum(["queued", "processing", "completed", "failed", "unscored"]);

export const jobCriterionSchema = z.object({
  id: uuidSchema.optional(),
  ordinal: positiveInteger,
  kind: jobCriterionKindSchema,
  requirement: z.string().trim().min(2).max(1000),
  isRequired: z.boolean().default(true),
});

export const jobOpeningSchema = z.object({
  id: positiveInteger.optional(),
  departmentId: positiveInteger,
  positionId: positiveInteger,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20).max(10_000),
  location: optionalText(160),
  closesOn: isoDateSchema.optional(),
  status: jobOpeningStatusSchema.default("draft"),
  criteria: z.array(jobCriterionSchema).min(1).max(30),
});

export const applicantProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  middleName: optionalText(80),
  lastName: z.string().trim().min(1).max(80),
  phone: optionalText(32),
  address: optionalText(500),
});

export const applicantDocumentSchema = z.object({
  id: uuidSchema.optional(),
  kind: applicantDocumentKindSchema,
  objectPath: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum([
    "application/pdf",
    "image/png",
    "image/jpeg",
  ]),
  sizeBytes: z.coerce.number().int().positive().max(10 * 1024 * 1024),
});

export const applicationSubmissionSchema = z.object({
  applicationId: uuidSchema,
  jobId: positiveInteger,
  coverNote: optionalText(2_000),
  documents: z.array(applicantDocumentSchema).min(1).refine(
    (documents) => documents.some((document) => document.kind === "cv"),
    "Attach a CV before submitting.",
  ),
});

export const applicationStatusTransitionSchema = z.object({
  applicationId: uuidSchema,
  nextStatus: applicationStatusSchema,
  note: optionalText(2_000),
});

export const hiringDecisionSchema = z.object({
  applicationId: uuidSchema,
  employeeNumber: employeeNumberSchema,
  departmentId: positiveInteger,
  positionId: positiveInteger,
  employmentStartedOn: isoDateSchema,
  note: optionalText(2_000),
});

export const jobFiltersSchema = paginationSchema.extend({
  search: optionalText(120),
  status: jobOpeningStatusSchema.optional(),
});

export const applicationFiltersSchema = paginationSchema.extend({
  search: optionalText(120),
  status: applicationStatusSchema.optional(),
  jobId: positiveInteger.optional(),
});
export const applicationAiFiltersSchema = applicationFiltersSchema.extend({ aiStatus: applicationAiStatusSchema.optional(), minimumScore: z.coerce.number().int().min(0).max(100).optional() });

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type JobOpeningInput = z.infer<typeof jobOpeningSchema>;
export type JobCriterionInput = z.infer<typeof jobCriterionSchema>;
export type ApplicantProfileInput = z.infer<typeof applicantProfileSchema>;
export type ApplicantDocumentInput = z.infer<typeof applicantDocumentSchema>;
export type ApplicationSubmissionInput = z.infer<typeof applicationSubmissionSchema>;
export type ApplicationStatusTransitionInput = z.infer<typeof applicationStatusTransitionSchema>;
export type HiringDecisionInput = z.infer<typeof hiringDecisionSchema>;
export type JobFilters = z.infer<typeof jobFiltersSchema>;
export type ApplicationFilters = z.infer<typeof applicationFiltersSchema>;
export type ApplicationAiFilters = z.infer<typeof applicationAiFiltersSchema>;
