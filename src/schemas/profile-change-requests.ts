import { z } from "zod";

import { isoDateSchema, uuidSchema } from "./common";

const profileChangeStatuses = ["pending", "approved", "rejected", "cancelled"] as const;
/**
 * Every personal field HR enters on the official record that an employee can ask to correct.
 * The request kind stays "contact" for compatibility with earlier requests.
 */
export const PERSONAL_FIELDS = [
  "employeeNumber",
  "firstName",
  "middleName",
  "lastName",
  "qualifier",
  "placeOfBirth",
  "dateOfBirth",
  "gender",
  "civilStatus",
  "religion",
  "personalEmail",
  "phone",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
  "sssNumber",
  "philhealthNumber",
  "gsisNumber",
  "pagibigNumber",
  "employmentStartedOn",
] as const;
export type PersonalField = (typeof PERSONAL_FIELDS)[number];

/** Display labels for personal fields, matching the HR employee form. */
export const PERSONAL_FIELD_LABELS: Record<PersonalField, string> = {
  employeeNumber: "Badge / ID number",
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  qualifier: "Qualifier",
  placeOfBirth: "Place of birth",
  dateOfBirth: "Date of birth",
  gender: "Gender",
  civilStatus: "Civil status",
  religion: "Religion",
  personalEmail: "Personal email",
  phone: "Phone number",
  address: "Home address",
  emergencyContactName: "Emergency contact name",
  emergencyContactPhone: "Emergency contact phone number",
  emergencyContactRelationship: "Emergency contact relationship",
  sssNumber: "SSS number",
  philhealthNumber: "PhilHealth number",
  gsisNumber: "GSIS number",
  pagibigNumber: "Pag-IBIG number",
  employmentStartedOn: "Date Entered Service",
};

/** Fields that may be cleared; every other personal field needs a value. */
const OPTIONAL_PERSONAL_FIELDS: ReadonlySet<PersonalField> = new Set(["middleName", "qualifier", "sssNumber", "philhealthNumber", "gsisNumber", "pagibigNumber"]);
const PERSONAL_GENDERS = ["female", "male"] as const;
const PERSONAL_CIVIL_STATUSES = ["single", "married", "widowed", "separated", "divorced"] as const;
const PERSONAL_RELATIONSHIPS = ["spouse", "parent", "child", "sibling", "other"] as const;
const GOVERNMENT_ID_DIGITS: Partial<Record<PersonalField, [number, string]>> = {
  sssNumber: [10, "Enter a 10-digit SSS number."],
  philhealthNumber: [12, "Enter a 12-digit PhilHealth number."],
  gsisNumber: [11, "Enter an 11-digit GSIS number."],
  pagibigNumber: [12, "Enter a 12-digit Pag-IBIG number."],
};

/** Why a requested personal value cannot be submitted, or null when it is valid (same rules as the database). */
export function personalFieldError(field: PersonalField, value: string | null): string | null {
  if (value === null || value === "") return OPTIONAL_PERSONAL_FIELDS.has(field) ? null : "A value is required for this field.";
  const digits = GOVERNMENT_ID_DIGITS[field];
  if (digits) return /^\d+$/.test(value) && value.length === digits[0] ? null : digits[1];
  switch (field) {
    case "employeeNumber":
      return /^(\d-\d{5}|\d{8})$/.test(value) ? null : "Badge number must be 6 digits in the format 0-00000, or an 8-digit ID number for NUP.";
    case "firstName":
    case "middleName":
    case "lastName":
      return value.length > 80 ? "Names can have at most 80 characters." : null;
    case "qualifier":
      return value.length > 40 ? "The qualifier can have at most 40 characters." : null;
    case "placeOfBirth":
      return value.length > 160 ? "The place of birth can have at most 160 characters." : null;
    case "religion":
      return value.length > 120 ? "The religion can have at most 120 characters." : null;
    case "dateOfBirth":
    case "employmentStartedOn":
      if (!isoDateSchema.safeParse(value).success) return "Enter a valid date.";
      return value > new Date().toISOString().slice(0, 10) ? "The date cannot be in the future." : null;
    case "gender":
      return (PERSONAL_GENDERS as readonly string[]).includes(value) ? null : "Choose a gender.";
    case "civilStatus":
      return (PERSONAL_CIVIL_STATUSES as readonly string[]).includes(value) ? null : "Choose a civil status.";
    case "emergencyContactRelationship":
      return (PERSONAL_RELATIONSHIPS as readonly string[]).includes(value) ? null : "Choose the emergency contact relationship.";
    case "personalEmail":
      return z.email().safeParse(value).success ? null : "Enter a valid personal email address.";
    case "phone":
    case "emergencyContactPhone":
      return value.length < 3 || value.length > 32 ? "Enter a valid phone number." : null;
    case "address":
      return value.length < 3 || value.length > 500 ? "The address must have 3 to 500 characters." : null;
    case "emergencyContactName":
      return value.length < 2 || value.length > 160 ? "The emergency contact name must have 2 to 160 characters." : null;
    default:
      return null;
  }
}
const documentMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || undefined).optional();
const nullableText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable();

export const profileChangeQualificationSnapshotSchema = z.object({
  name: z.string().trim().min(2).max(160),
  // Eligibility no longer records an institution, level, or field of study; older entries may still carry them.
  institution: nullableText(160).optional().transform((value) => value ?? null),
  qualificationLevel: nullableText(80),
  fieldOfStudy: nullableText(160),
  awardedOn: isoDateSchema,
  notes: nullableText(2000),
  /** Rating in percent, e.g. 85 for NAPOLCOM 85%. Snapshots taken before ratings existed have none. */
  rating: z.number().min(0, "Enter a rating from 0 to 100.").max(100, "Enter a rating from 0 to 100.").nullable().optional(),
});

export const profileChangeCertificationSnapshotSchema = z.object({
  name: z.string().trim().min(2).max(160),
  issuer: nullableText(160),
  credentialId: nullableText(160),
  issuedOn: isoDateSchema,
  expiresOn: z.union([isoDateSchema, z.null()]),
  notes: nullableText(2000),
}).refine((value) => !value.expiresOn || value.expiresOn >= value.issuedOn, {
  message: "Expiry date cannot be before the issue date.",
  path: ["expiresOn"],
});

export const profileChangeTrainingSnapshotSchema = z.object({
  courseName: z.string().trim().min(2).max(160),
  provider: z.string().trim().min(2).max(160),
  completedOn: isoDateSchema,
  expiresOn: z.union([isoDateSchema, z.null()]),
  hours: z.number().min(0).max(9999.99).nullable(),
  notes: nullableText(2000),
}).refine((value) => !value.expiresOn || value.expiresOn >= value.completedOn, {
  message: "Expiry date cannot be before the completion date.",
  path: ["expiresOn"],
});

export const profileChangeContactChangeSchema = z.object({
  kind: z.literal("contact"),
  field: z.enum(PERSONAL_FIELDS),
  originalValue: nullableText(500),
  requestedValue: nullableText(500),
}).superRefine((value, context) => {
  const message = personalFieldError(value.field, value.requestedValue);
  if (message) context.addIssue({ code: "custom", path: ["requestedValue"], message });
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

export const profileChangeCertificationChangeSchema = z.union([
  z.object({ kind: z.literal("certification"), operation: z.literal("add"), originalValue: z.null(), requestedValue: profileChangeCertificationSnapshotSchema }),
  z.object({ kind: z.literal("certification"), operation: z.literal("edit"), certificationId: uuidSchema, originalValue: profileChangeCertificationSnapshotSchema, requestedValue: profileChangeCertificationSnapshotSchema }),
  z.object({ kind: z.literal("certification"), operation: z.literal("remove"), certificationId: uuidSchema, originalValue: profileChangeCertificationSnapshotSchema, requestedValue: z.null() }),
]);

export const profileChangeTrainingChangeSchema = z.union([
  z.object({ kind: z.literal("training"), operation: z.literal("add"), originalValue: z.null(), requestedValue: profileChangeTrainingSnapshotSchema }),
  z.object({ kind: z.literal("training"), operation: z.literal("edit"), trainingRecordId: uuidSchema, originalValue: profileChangeTrainingSnapshotSchema, requestedValue: profileChangeTrainingSnapshotSchema }),
  z.object({ kind: z.literal("training"), operation: z.literal("remove"), trainingRecordId: uuidSchema, originalValue: profileChangeTrainingSnapshotSchema, requestedValue: z.null() }),
]);

export const profileChangeChangeSchema = z.union([
  profileChangeContactChangeSchema,
  profileChangeQualificationChangeSchema,
  profileChangeCertificationChangeSchema,
  profileChangeTrainingChangeSchema,
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
  changes: z.array(profileChangeChangeSchema).min(1).max(30),
});

export const profileChangeSubmissionSchema = profileChangeDraftSchema.extend({
  requestId: uuidSchema,
  documents: z.array(profileChangeDocumentSchema).min(1, "Attach at least one supporting document.").max(10),
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
