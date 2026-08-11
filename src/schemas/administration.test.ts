import { describe, expect, it } from "vitest";

import {
  administrationFiltersSchema,
  departmentSchema,
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
});
