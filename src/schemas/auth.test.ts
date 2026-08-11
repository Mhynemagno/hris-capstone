import { describe, expect, it } from "vitest";

import {
  applicantRegistrationSchema,
  forgotPasswordSchema,
  inviteInternalUserSchema,
  loginSchema,
  resetPasswordSchema,
} from "./auth";

describe("authentication schemas", () => {
  it("rejects invalid sign-in credentials", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "short" })
        .success,
    ).toBe(false);
  });

  it("accepts a valid applicant registration", () => {
    expect(
      applicantRegistrationSchema.safeParse({
        email: "applicant@example.com",
        fullName: "Applicant One",
        password: "secret1",
      }).success,
    ).toBe(true);
  });

  it("requires a valid recovery email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "invalid" }).success).toBe(
      false,
    );
  });

  it("requires matching reset passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "secret1",
        passwordConfirmation: "secret2",
      }).success,
    ).toBe(false);
  });

  it("rejects applicant as an internal invitation role", () => {
    expect(
      inviteInternalUserSchema.safeParse({
        email: "person@example.com",
        fullName: "Person One",
        role: "applicant",
      }).success,
    ).toBe(false);
  });
});
