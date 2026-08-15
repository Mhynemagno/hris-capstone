import { z } from "zod";

import { namePartsSchema, withFullName } from "./name";

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.");

export const loginSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});

export const applicantRegistrationSchema = loginSchema.extend({
  ...namePartsSchema.shape,
}).transform(withFullName);

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
