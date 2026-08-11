import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.");

export const loginSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});

export const applicantRegistrationSchema = loginSchema.extend({
  fullName: z.string().trim().min(2).max(120),
});

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

export const inviteInternalUserSchema = applicantRegistrationSchema
  .pick({ email: true, fullName: true })
  .extend({
    role: z.enum([
      "system_administrator",
      "hr_personnel",
      "employee",
      "management",
    ]),
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ApplicantRegistrationInput = z.infer<
  typeof applicantRegistrationSchema
>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InviteInternalUserInput = z.infer<typeof inviteInternalUserSchema>;
