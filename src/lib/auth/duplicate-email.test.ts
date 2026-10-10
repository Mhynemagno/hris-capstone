import { describe, expect, it } from "vitest";

import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmailError, isObfuscatedExistingUser } from "./duplicate-email";

describe("duplicate email detection", () => {
  it("uses the client's wording", () => {
    expect(DUPLICATE_EMAIL_MESSAGE).toBe("This email is already registered.");
  });

  it("recognises Supabase Auth duplicate errors by code or message", () => {
    expect(isDuplicateEmailError({ code: "user_already_exists", message: "x" })).toBe(true);
    expect(isDuplicateEmailError({ code: "email_exists", message: "x" })).toBe(true);
    expect(isDuplicateEmailError({ message: "User already registered" })).toBe(true);
    expect(isDuplicateEmailError({ message: "A user with this email address has already been registered" })).toBe(true);
  });

  it("ignores other errors and empty values", () => {
    expect(isDuplicateEmailError({ code: "weak_password", message: "Password is too weak" })).toBe(false);
    expect(isDuplicateEmailError(null)).toBe(false);
    expect(isDuplicateEmailError(undefined)).toBe(false);
  });

  it("detects the identity-less user Supabase returns for an existing email when confirmation is on", () => {
    expect(isObfuscatedExistingUser({ identities: [] })).toBe(true);
    expect(isObfuscatedExistingUser({ identities: [{ id: "1" }] })).toBe(false);
    expect(isObfuscatedExistingUser({})).toBe(false);
    expect(isObfuscatedExistingUser(null)).toBe(false);
  });
});
