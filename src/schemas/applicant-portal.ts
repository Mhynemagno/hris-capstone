import { z } from "zod";

import "./error-messages";

import { philippineMobileSchema } from "./auth";
import { applicantProfileSchema } from "./recruitment";

export const APPLICANT_EDUCATION_LEVELS = [
  { level: "elementary", label: "Elementary" },
  { level: "secondary", label: "Secondary" },
  { level: "college", label: "College / Tertiary" },
] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || undefined).optional();

const currentYear = () => new Date().getFullYear();

const yearGraduatedSchema = z
  .union([z.literal(""), z.coerce.number({ error: "Enter a four-digit year." }).int("Enter a four-digit year.")])
  .refine((value) => value === "" || (value >= 1900 && value <= currentYear()), { message: `Enter a year from 1900 to ${currentYear()}.` })
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const applicantEducationEntrySchema = z.object({
  schoolName: optionalText(200),
  degreeCourse: optionalText(200),
  yearGraduated: yearGraduatedSchema,
});

export const applicantEducationSchema = z.object({
  elementary: applicantEducationEntrySchema,
  secondary: applicantEducationEntrySchema,
  college: applicantEducationEntrySchema,
});

/** An optional Philippine mobile number on the profile; saved normalized to +639XXXXXXXXX. */
const optionalMobileSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return undefined;
    const parsed = philippineMobileSchema.safeParse(value);
    if (!parsed.success) {
      context.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Enter a valid mobile number." });
      return z.NEVER;
    }
    return parsed.data;
  })
  .optional();

/** The personal data sheet: I. Personal Information and II. Educational Background. */
export const applicantPersonalDataSheetSchema = applicantProfileSchema.extend({
  phone: optionalMobileSchema,
  education: applicantEducationSchema,
});

export type ApplicantEducationInput = z.input<typeof applicantEducationSchema>;
export type ApplicantEducationValues = z.output<typeof applicantEducationSchema>;
export type ApplicantPersonalDataSheetInput = z.input<typeof applicantPersonalDataSheetSchema>;
export type ApplicantPersonalDataSheetValues = z.output<typeof applicantPersonalDataSheetSchema>;
