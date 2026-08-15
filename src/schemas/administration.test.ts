import { describe, expect, it } from "vitest";

import {
  auditLogFiltersSchema,
  administrationFiltersSchema,
  departmentSchema,
  internalInvitationSchema,
  managedUserFiltersSchema,
  managedUserUpdateSchema,
  organizationSettingsSchema,
  positionSchema,
} from "./administration";

describe("administration schemas", () => {
  it("accepts a direct applicant-to-employee role change", () => {
    expect(
      managedUserUpdateSchema.safeParse({
        userId: "123e4567-e89b-42d3-a456-426614174000",
        role: "employee",
        isActive: true,
      }).success,
    ).toBe(true);
  });

  it("rejects blank reference data and invalid settings", () => {
    expect(departmentSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(positionSchema.safeParse({ title: "", code: "   " }).success).toBe(false);
    expect(
      organizationSettingsSchema.safeParse({
        organizationName: "HRIS",
        supportEmail: "invalid",
        defaultTimezone: "",
      }).success,
    ).toBe(false);
  });

  it("rejects pagination outside safe bounds", () => {
    expect(
      administrationFiltersSchema.safeParse({
        page: "0",
        pageSize: "999",
        role: "applicant",
      }).success,
    ).toBe(false);
  });

  it("accepts internal invitations with name parts and 20-row managed-user pages", () => {
    expect(
      internalInvitationSchema.parse({
        email: "new.hr@example.com",
        firstName: "New",
        lastName: "HR",
        role: "hr_personnel",
      }),
    ).toMatchObject({ firstName: "New", lastName: "HR", fullName: "New HR", role: "hr_personnel" });
    expect(
      managedUserFiltersSchema.parse({ page: "2", pageSize: 20, status: "active" }),
    ).toMatchObject({ page: 2, pageSize: 20, status: "active" });
  });

  it("rejects applicant invitations and non-20 page sizes while clearing blank audit filters", () => {
    expect(
      internalInvitationSchema.safeParse({
        email: "applicant@example.com",
        firstName: "Applicant",
        lastName: "User",
        role: "applicant",
      }).success,
    ).toBe(false);
    expect(auditLogFiltersSchema.parse({ entityType: " ", pageSize: 20 }).entityType).toBeUndefined();
    expect(managedUserFiltersSchema.safeParse({ pageSize: 21 }).success).toBe(false);
  });

  it("rejects invitations with a missing name part", () => {
    expect(
      internalInvitationSchema.safeParse({
        email: "new.hr@example.com",
        firstName: "New",
        lastName: "",
        role: "hr_personnel",
      }).success,
    ).toBe(false);
  });
});
