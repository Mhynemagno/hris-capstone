import { z } from "zod";

import { employeeNumberSchema, isoDateSchema, uuidSchema } from "./common";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

const optionalDate = isoDateSchema.optional();

/** Required free text with a field-specific message when it is left blank. */
const requiredText = (max: number, message: string) =>
  z.string({ error: message }).trim().min(1, message).max(max);

/** Philippine mobile number as stored on the official record: +639 followed by 9 digits. */
export const PHILIPPINE_MOBILE_PATTERN = /^\+639\d{9}$/;

/**
 * Rewrites a saved or typed mobile number into the +639XXXXXXXXX format:
 * spaces and dashes are dropped and the local 09XXXXXXXXX form gets the +63 prefix.
 * Anything else is returned cleaned but otherwise unchanged so validation can explain it.
 */
export function toPhilippineMobile(value: string | null | undefined) {
  const cleaned = (value ?? "").trim().replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;
  if (/^639\d{9}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
}

/** An optional government ID number: dashes and spaces are dropped, blank means none, and the digit count is checked. */
const governmentIdNumber = (digits: number, message: string) =>
  z
    .string()
    .optional()
    .transform((value) => (value ?? "").replace(/[\s-]/g, "") || undefined)
    .refine((value) => value === undefined || (/^\d+$/.test(value) && value.length === digits), message)
    .optional();

export const sssNumberSchema = governmentIdNumber(10, "Enter a 10-digit SSS number.");
export const philhealthNumberSchema = governmentIdNumber(12, "Enter a 12-digit PhilHealth number.");

export const governmentIdsSchema = z.object({ sssNumber: sssNumberSchema, philhealthNumber: philhealthNumberSchema });

/** Same format as `philippineMobileSchema` in auth, with the wording HR sees on the employee form. */
const requiredMobile = (message: string) =>
  z
    .string({ error: message })
    .transform(toPhilippineMobile)
    .pipe(z.string().min(1, message).regex(PHILIPPINE_MOBILE_PATTERN, "Enter the number as +639XXXXXXXXX."));

const employmentStatuses = ["active", "retired"] as const;
const profilePhotoMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
const genders = ["female", "male", "prefer_not_to_say"] as const;
const civilStatuses = ["single", "married", "widowed", "separated", "divorced"] as const;

export const profilePhotoFileSchema = z.custom<File>(
  (value) => typeof File !== "undefined" && value instanceof File,
  "Choose an image file.",
).superRefine((file, context) => {
  if (!profilePhotoMimeTypes.includes(file.type as typeof profilePhotoMimeTypes[number])) {
    context.addIssue({ code: "custom", message: "Use a PNG, JPEG, or WebP image." });
  }
  if (file.size < 1 || file.size > 5 * 1024 * 1024) {
    context.addIssue({ code: "custom", message: "Use an image up to 5 MiB." });
  }
});

/**
 * Suggested education levels for qualification dropdowns. The database keeps
 * this column as free text (max 80 chars) so historic values stay valid; forms
 * offer these choices and show any unlisted existing value as its own option.
 */
export const QUALIFICATION_LEVELS = [
  "Elementary",
  "High School",
  "Senior High School",
  "Vocational / Technical",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
  "Other",
] as const;

const hasValidDateRange = (startKey: string, endKey: string) => (value: Record<string, unknown>) => {
  const start = value[startKey];
  const end = value[endKey];
  return !start || !end || String(end) >= String(start);
};

export const employeeSchema = z
  .object({
    profileId: uuidSchema.optional(),
    employeeNumber: employeeNumberSchema,
    firstName: z.string().trim().min(1).max(80),
    middleName: optionalText(80),
    lastName: z.string().trim().min(1).max(80),
    qualifier: optionalText(32),
    placeOfBirth: requiredText(160, "Enter the place of birth."),
    dateOfBirth: z.iso.date({ error: (issue) => (issue.input === undefined || issue.input === "" ? "Enter the date of birth." : "Enter a valid date of birth.") }),
    gender: z.enum(genders, { error: "Choose a gender." }),
    civilStatus: z.enum(civilStatuses, { error: "Choose a civil status." }),
    religion: requiredText(120, "Enter the religion."),
    unitStation: optionalText(160),
    personalEmail: z.string().trim().toLowerCase().pipe(z.email()),
    phone: requiredMobile("Enter the phone number."),
    address: requiredText(500, "Enter the home address."),
    emergencyContactName: requiredText(160, "Enter the emergency contact."),
    emergencyContactPhone: requiredMobile("Enter the emergency contact phone."),
    sssNumber: sssNumberSchema,
    philhealthNumber: philhealthNumberSchema,
    departmentId: z.coerce.number({ error: "Choose a unit / section." }).int().positive("Choose a unit / section."),
    rankId: z.coerce.number({ error: "Choose a rank." }).int().positive("Choose a rank."),
    employmentStatus: z.enum(employmentStatuses).default("active"),
    employmentStartedOn: z.iso.date({ error: (issue) => (issue.input === undefined || issue.input === "" ? "Enter the employment start date." : "Enter a valid date.") }),
    // Not shown on the form; an existing end date is carried through unchanged.
    employmentEndedOn: optionalDate,
  })
  .refine(hasValidDateRange("employmentStartedOn", "employmentEndedOn"), {
    message: "Employment end date cannot be before the start date.",
    path: ["employmentEndedOn"],
  });

export const serviceHistorySchema = z
  .object({
    id: uuidSchema.optional(),
    employeeId: uuidSchema,
    departmentId: z.coerce.number({ error: "Choose a unit / section." }).int().positive("Choose a unit / section."),
    rankId: z.coerce.number({ error: "Choose a rank." }).int().positive("Choose a rank."),
    employmentTitle: optionalText(160),
    startedOn: isoDateSchema,
    endedOn: optionalDate,
    notes: optionalText(2000),
  })
  .refine(hasValidDateRange("startedOn", "endedOn"), {
    message: "End date cannot be before the start date.",
    path: ["endedOn"],
  });

export const qualificationSchema = z.object({
  id: uuidSchema.optional(),
  employeeId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  // Eligibility no longer records where it was earned; kept optional for older entries.
  institution: optionalText(160),
  qualificationLevel: optionalText(80),
  fieldOfStudy: optionalText(160),
  awardedOn: isoDateSchema,
  notes: optionalText(2000),
});

export const certificationSchema = z
  .object({
    id: uuidSchema.optional(),
    employeeId: uuidSchema,
    name: z.string().trim().min(2).max(160),
    // Certification / Training no longer records an issuer; kept optional for older entries.
    issuer: optionalText(160),
    credentialId: optionalText(160),
    issuedOn: isoDateSchema,
    expiresOn: optionalDate,
    notes: optionalText(2000),
  })
  .refine(hasValidDateRange("issuedOn", "expiresOn"), {
    message: "Expiry date cannot be before the completion date.",
    path: ["expiresOn"],
  });

export const trainingRecordSchema = z
  .object({
    id: uuidSchema.optional(),
    employeeId: uuidSchema,
    courseName: z.string().trim().min(2).max(160),
    provider: z.string().trim().min(2).max(160),
    completedOn: isoDateSchema,
    expiresOn: optionalDate,
    hours: z.coerce.number().min(0).max(9999.99).optional(),
    notes: optionalText(2000),
  })
  .refine(hasValidDateRange("completedOn", "expiresOn"), {
    message: "Expiry date cannot be before the completion date.",
    path: ["expiresOn"],
  });

export const employeeDirectoryFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().transform((value) => Math.min(value, 100)).default(25),
  search: z.string().trim().max(120).transform((value) => value || undefined).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  rankId: z.coerce.number().int().positive().optional(),
  employmentStatus: z.enum(employmentStatuses).optional(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
export type ServiceHistoryInput = z.infer<typeof serviceHistorySchema>;
export type QualificationInput = z.infer<typeof qualificationSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
export type TrainingRecordInput = z.infer<typeof trainingRecordSchema>;
export type EmployeeDirectoryFilters = z.infer<typeof employeeDirectoryFiltersSchema>;
export type GovernmentIdsInput = z.infer<typeof governmentIdsSchema>;
