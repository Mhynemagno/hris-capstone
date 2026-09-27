import { describe, expect, it } from "vitest";

import {
  applicantRegistrationSchema,
  forgotPasswordSchema,
  inviteInternalUserSchema,
  loginSchema,
  resetPasswordSchema,
} from "./auth";

const validRegistration = {
  email: "applicant@example.com",
  mobileNumber: "0917 123 4567",
  firstName: "Applicant",
  lastName: "One",
  middleName: "Santos",
  qualifier: "None",
  birthdate: "1990-01-31",
  password: "secret1",
  confirmPassword: "secret1",
};

describe("authentication schemas", () => {
  it("rejects invalid sign-in credentials", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "short" })
        .success,
    ).toBe(false);
  });

  it("accepts a valid applicant registration", () => {
    expect(
      applicantRegistrationSchema.parse({ ...validRegistration }),
    ).toMatchObject({
      firstName: "Applicant",
      lastName: "One",
      middleName: "Santos",
      qualifier: null,
      mobileNumber: "+639171234567",
      birthdate: "1990-01-31",
      fullName: "Applicant One",
    });
  });

  it("accepts +639 mobile numbers and rejects other formats", () => {
    expect(applicantRegistrationSchema.parse({ ...validRegistration, mobileNumber: "+639998887777" }).mobileNumber).toBe("+639998887777");
    for (const mobileNumber of ["9171234567", "+63917123456", "08171234567", "+6391712345678", ""]) {
      expect(applicantRegistrationSchema.safeParse({ ...validRegistration, mobileNumber }).success).toBe(false);
    }
  });

  it("keeps a chosen qualifier and requires one to be picked", () => {
    expect(applicantRegistrationSchema.parse({ ...validRegistration, qualifier: "III" }).qualifier).toBe("III");
    expect(applicantRegistrationSchema.safeParse({ ...validRegistration, qualifier: "" }).success).toBe(false);
    expect(applicantRegistrationSchema.safeParse({ ...validRegistration, qualifier: "Sr." }).success).toBe(false);
  });

  it("requires a past birthdate without an age limit and matching passwords", () => {
    expect(applicantRegistrationSchema.safeParse({ ...validRegistration, birthdate: "2020-02-29" }).success).toBe(true);
    expect(applicantRegistrationSchema.safeParse({ ...validRegistration, birthdate: "2999-01-01" }).success).toBe(false);
    expect(applicantRegistrationSchema.safeParse({ ...validRegistration, birthdate: "" }).success).toBe(false);
    const mismatch = applicantRegistrationSchema.safeParse({ ...validRegistration, confirmPassword: "other1" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]).toMatchObject({ path: ["confirmPassword"], message: "Passwords do not match." });
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
        firstName: "Person",
        lastName: "One",
        role: "applicant",
      }).success,
    ).toBe(false);
  });

  it("requires both applicant name parts", () => {
    expect(
      applicantRegistrationSchema.safeParse({
        email: "applicant@example.com",
        firstName: "",
        lastName: "One",
        password: "secret1",
      }).success,
    ).toBe(false);
  });
});
