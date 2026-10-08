import { z } from "zod";

import "./error-messages";

import { namePartsSchema, withFullName } from "./name";

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.");

export const loginSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});
export const internalLoginSchema = z.object({ identifier: z.string().trim().min(1), password: passwordSchema });

export type LoginMode = "applicant" | "employee";

const applicantNumberLoginSchema = z.string().trim().transform((value) => value.replace(/[^0-9]/g, "")).refine((value) => /^\d{6,}$/.test(value), "Enter your Applicant Number.");
const badgeNumberLoginSchema = z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().min(1, "Enter your Badge Number.").max(32, "Enter a valid Badge Number."));

/** Validates the public identifier only; its email lookup remains server-only. */
export function loginIdentifierSchema(mode: LoginMode) {
  return z.object({
    identifier: mode === "applicant" ? applicantNumberLoginSchema : badgeNumberLoginSchema,
    password: passwordSchema,
  });
}

/** Name qualifiers offered at registration; "None" is stored as no qualifier. */
export const APPLICANT_QUALIFIERS = ["Jr.", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"] as const;

/** Philippine mobile number: accepts +639XXXXXXXXX or 09XXXXXXXXX and normalizes to +639XXXXXXXXX. */
export const philippineMobileSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => value !== "", "Mobile number is required.")
  .refine((value) => value === "" || /^(\+639|09)\d{9}$/.test(value), "Enter a valid mobile number, e.g. +639171234567.")
  .transform((value) => (value.startsWith("09") ? `+63${value.slice(1)}` : value));

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const applicantRegistrationSchema = z
  .object({
    email: z.email(),
    mobileNumber: philippineMobileSchema,
    ...namePartsSchema.shape,
    middleName: z.string().trim().max(60).transform((value) => value || undefined),
    qualifier: z.enum([...APPLICANT_QUALIFIERS, "None"], { error: "Choose a qualifier, or None." }),
    birthdate: z.iso.date({ error: (issue) => (issue.input === "" ? "Birthdate is required." : "Enter a valid birthdate.") }).refine((value) => value < localToday(), "Birthdate must be in the past."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." })
  .transform(({ email, mobileNumber, firstName, lastName, middleName, qualifier, birthdate, password }) =>
    withFullName({ email, mobileNumber, firstName, lastName, middleName, qualifier: qualifier === "None" ? null : qualifier, birthdate, password }));

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .refine(({ password, passwordConfirmation }) => password === passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

export const inviteInternalUserSchema = z.object({
  email: z.email(),
  ...namePartsSchema.shape,
  role: z.enum([
    "system_administrator",
    "hr_personnel",
    "employee",
    "management",
  ]),
}).transform(withFullName);

export type LoginInput = z.infer<typeof loginSchema>;
export type ApplicantRegistrationInput = z.infer<
  typeof applicantRegistrationSchema
>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InviteInternalUserInput = z.infer<typeof inviteInternalUserSchema>;
