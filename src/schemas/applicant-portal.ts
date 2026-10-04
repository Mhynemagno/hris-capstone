import { z } from "zod";

import type { ApplicantProfileDocumentKind } from "@/lib/types/database";

import "./error-messages";

import { philippineMobileSchema } from "./auth";
import { applicantProfileSchema } from "./recruitment";

/**
 * II. Educational Background levels. The stored level keys predate the tester's labels:
 * `elementary` is shown as Primary and `college` as Bachelor's Degree.
 */
export const APPLICANT_EDUCATION_LEVELS = [
  { level: "elementary", label: "Primary", required: true },
  { level: "secondary", label: "Secondary", required: true },
  { level: "college", label: "Bachelor's Degree", required: true },
  { level: "graduate", label: "Graduate Degree", required: false },
] as const;

/** The documents an applicant saves on the Documents page; all are required before applying. Only the 2x2 picture is an image. */
export const APPLICANT_PROFILE_DOCUMENT_KINDS = [
  { kind: "resume", label: "CV / Resume", accept: "application/pdf", formats: "PDF only" },
  { kind: "psa", label: "PSA birth certificate", accept: "application/pdf", formats: "PDF only" },
  { kind: "photo", label: "2x2 picture", accept: "image/png,image/jpeg", formats: "PNG or JPEG image" },
  { kind: "eligibility", label: "Eligibility", accept: "application/pdf", formats: "PDF only" },
  { kind: "diploma", label: "Diploma", accept: "application/pdf", formats: "PDF only" },
] as const;

const applicantPhotoDocumentMimeTypes = ["image/png", "image/jpeg"] as const;

/** The 2x2 picture must be an image, not a PDF. */
export const applicantPhotoDocumentFileSchema = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
  "Choose an image file.",
).superRefine((file, context) => {
  if (!applicantPhotoDocumentMimeTypes.includes(file.type as typeof applicantPhotoDocumentMimeTypes[number])) {
    context.addIssue({ code: "custom", message: "Use a PNG or JPEG image for the 2x2 picture." });
  }
  if (file.size < 1 || file.size > 10 * 1024 * 1024) {
    context.addIssue({ code: "custom", message: "Use an image up to 10 MiB." });
  }
});

function applicantPdfDocumentFileSchema(label: string) {
  return z.custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    "Choose a PDF file.",
  ).superRefine((file, context) => {
    if (file.type !== "application/pdf") {
      context.addIssue({ code: "custom", message: `Upload the ${label} as a PDF file.` });
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      context.addIssue({ code: "custom", message: "Use a document up to 10 MiB." });
    }
  });
}

/** The file rule for one required document: the 2x2 picture is PNG/JPEG, every other document is a PDF. */
export function profileDocumentFileSchemaFor(kind: ApplicantProfileDocumentKind) {
  if (kind === "photo") return applicantPhotoDocumentFileSchema;
  const { label } = APPLICANT_PROFILE_DOCUMENT_KINDS.find((item) => item.kind === kind)!;
  return applicantPdfDocumentFileSchema(label);
}

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

const requiredText = (max: number, message: string) => z.string({ error: message }).trim().min(1, message).max(max);

const currentYear = () => new Date().getFullYear();

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const yearGraduatedSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Enter a four-digit year." }).int("Enter a four-digit year.")])
  .refine((value) => value === "" || (value >= 1900 && value <= currentYear()), { message: `Enter a year from 1900 to ${currentYear()}.` })
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const applicantEducationEntrySchema = z.object({
  schoolName: optionalText(200),
  degreeCourse: optionalText(200),
  yearGraduated: yearGraduatedSchema,
  location: optionalText(200),
});

const educationFieldMessages = {
  schoolName: "Enter the name of the school.",
  degreeCourse: "Enter the course completed.",
  yearGraduated: "Enter the year graduated.",
  location: "Enter the school location.",
} as const;

type EducationEntry = z.output<typeof applicantEducationEntrySchema>;

/** Every field is required for a required level; an optional level is either left blank or filled in completely. */
function requireCompleteEntry(entry: EducationEntry, required: boolean, context: z.RefinementCtx) {
  const fields = Object.keys(educationFieldMessages) as (keyof typeof educationFieldMessages)[];
  const filled = fields.some((field) => entry[field] !== undefined);
  if (!required && !filled) return;
  for (const field of fields) {
    if (entry[field] === undefined) context.addIssue({ code: "custom", path: [field], message: educationFieldMessages[field] });
  }
}

const requiredEducationEntrySchema = applicantEducationEntrySchema.superRefine((entry, context) => requireCompleteEntry(entry, true, context));
const optionalEducationEntrySchema = applicantEducationEntrySchema.superRefine((entry, context) => requireCompleteEntry(entry, false, context));

export const applicantEducationSchema = z.object({
  elementary: requiredEducationEntrySchema,
  secondary: requiredEducationEntrySchema,
  college: requiredEducationEntrySchema,
  graduate: optionalEducationEntrySchema,
});

/** The qualifier is required, with "None" as a valid answer (stored as no qualifier, as at registration). */
const requiredQualifierSchema = z
  .string({ error: "Choose a qualifier, or None." })
  .trim()
  .min(1, "Choose a qualifier, or None.")
  .max(32)
  .transform((value) => (value === "None" ? undefined : value));

/** The personal data sheet: I. Personal Information and II. Educational Background. */
export const applicantPersonalDataSheetSchema = applicantProfileSchema.extend({
  qualifier: requiredQualifierSchema,
  dateOfBirth: z
    .iso.date({ error: (issue) => (issue.input === "" || issue.input === undefined ? "Date of birth is required." : "Enter a valid date of birth.") })
    .refine((value) => value < localToday(), "Date of birth must be in the past."),
  placeOfBirth: requiredText(160, "Enter your place of birth."),
  citizenship: requiredText(80, "Enter your citizenship."),
  gender: z.enum(["female", "male", "prefer_not_to_say"], { error: "Choose your gender." }),
  civilStatus: z.enum(["single", "married", "widowed", "separated", "divorced"], { error: "Choose your civil status." }),
  religion: requiredText(120, "Enter your religion."),
  phone: philippineMobileSchema,
  address: requiredText(500, "Enter your home address.").refine((value) => value.length >= 3, "Enter at least 3 characters."),
  education: applicantEducationSchema,
});

export type ApplicantEducationInput = z.input<typeof applicantEducationSchema>;
export type ApplicantEducationValues = z.output<typeof applicantEducationSchema>;
export type ApplicantPersonalDataSheetInput = z.input<typeof applicantPersonalDataSheetSchema>;
export type ApplicantPersonalDataSheetValues = z.output<typeof applicantPersonalDataSheetSchema>;
