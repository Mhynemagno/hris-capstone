import { describe, expect, it } from "vitest";

import {
  certificationSchema,
  employeeDirectoryFiltersSchema,
  employeeSchema,
  profilePhotoFileSchema,
  serviceHistorySchema,
  trainingRecordSchema,
  toPhilippineMobile,
} from "./personnel-records";

/** The personal and contact fields the official record now requires. */
const requiredPersonal = {
  placeOfBirth: "Quezon City",
  dateOfBirth: "1990-05-01",
  gender: "female",
  civilStatus: "single",
  religion: "Roman Catholic",
  phone: "+639171234567",
  address: "12 Mabini St., Quezon City",
  emergencyContactName: "Jose Reyes",
  emergencyContactPhone: "+639181234567",
  departmentId: "4",
  rankId: "1",
};

describe("personnel record schemas", () => {
  it("normalizes an official employee record before it reaches the database", () => {
    expect(
      employeeSchema.parse({
        employeeNumber: " 1-00001 ",
        firstName: " Erdene ",
        lastName: " Bat ",
        personalEmail: "EMPLOYEE@EXAMPLE.COM ",
        employmentStatus: "active",
        employmentStartedOn: "2024-01-01",
        ...requiredPersonal,
      }),
    ).toMatchObject({
      employeeNumber: "1-00001",
      firstName: "Erdene",
      personalEmail: "employee@example.com",
    });
  });

  it("records the rank by its catalogue id and allows only Active or On leave", () => {
    const base = {
      employeeNumber: "1-00002",
      firstName: "Ana",
      lastName: "Dela Cruz",
      personalEmail: "ana@example.com",
      employmentStartedOn: "2024-01-01",
      ...requiredPersonal,
    };
    expect(employeeSchema.parse({ ...base, rankId: "9", unitStation: "Station 1", employmentStatus: "on_leave" })).toMatchObject({
      rankId: 9,
      unitStation: "Station 1",
      employmentStatus: "on_leave",
    });
    expect(employeeSchema.safeParse({ ...base, employmentStatus: "separated" }).success).toBe(false);
    expect(employeeSchema.safeParse({ ...base, employmentStatus: "inactive" }).success).toBe(false);
  });

  it("blocks saving when a required personal or contact field is empty", () => {
    const base = { employeeNumber: "1-00003", firstName: "Ana", lastName: "Cruz", personalEmail: "ana@example.com", employmentStartedOn: "2024-01-01", ...requiredPersonal };
    expect(employeeSchema.safeParse(base).success).toBe(true);
    const messages: Record<string, string> = {
      placeOfBirth: "Enter the place of birth.",
      dateOfBirth: "Enter the date of birth.",
      gender: "Choose a gender.",
      religion: "Enter the religion.",
      phone: "Enter the phone number.",
      address: "Enter the home address.",
      emergencyContactName: "Enter the emergency contact.",
      emergencyContactPhone: "Enter the emergency contact phone.",
      civilStatus: "Choose a civil status.",
      departmentId: "Choose a unit / section.",
      rankId: "Choose a rank.",
    };
    for (const [field, message] of Object.entries(messages)) {
      const blank = employeeSchema.safeParse({ ...base, [field]: "" });
      expect(blank.success, field).toBe(false);
      expect(blank.error?.issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
      const missing = employeeSchema.safeParse({ ...base, [field]: undefined });
      expect(missing.success, field).toBe(false);
    }
    expect(employeeSchema.safeParse({ ...base, placeOfBirth: "   " }).success).toBe(false);
  });

  it("accepts phone numbers only as +639XXXXXXXXX, converting the local 09 form", () => {
    const base = { employeeNumber: "1-00004", firstName: "Ana", lastName: "Cruz", personalEmail: "ana@example.com", employmentStartedOn: "2024-01-01", ...requiredPersonal };
    expect(employeeSchema.parse({ ...base, phone: "09171234567", emergencyContactPhone: "0918 123 4567" })).toMatchObject({ phone: "+639171234567", emergencyContactPhone: "+639181234567" });
    for (const phone of ["+63917123456", "+6391712345678", "+638171234567", "8123-4567", "+63917abc4567"]) {
      const result = employeeSchema.safeParse({ ...base, phone });
      expect(result.success, phone).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Enter the number as +639XXXXXXXXX.");
    }
    expect(toPhilippineMobile("09171234567")).toBe("+639171234567");
    expect(toPhilippineMobile("639171234567")).toBe("+639171234567");
    expect(toPhilippineMobile(null)).toBe("");
  });

  it("rejects inverted official-record date ranges", () => {
    expect(
      serviceHistorySchema.safeParse({
        employeeId: "00000000-0000-0000-0000-000000000010",
        startedOn: "2026-02-01",
        endedOn: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(
      certificationSchema.safeParse({
        employeeId: "00000000-0000-0000-0000-000000000010",
        name: "First aid",
        issuer: "Red Cross",
        issuedOn: "2026-02-01",
        expiresOn: "2026-01-01",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid training hours and bounds directory filters", () => {
    expect(
      trainingRecordSchema.safeParse({
        employeeId: "00000000-0000-0000-0000-000000000010",
        courseName: "Safety",
        provider: "Academy",
        completedOn: "2026-01-01",
        hours: -1,
      }).success,
    ).toBe(false);
    expect(
      employeeDirectoryFiltersSchema.parse({ page: "2", pageSize: "200", search: "  Erdene " }),
    ).toMatchObject({ page: 2, pageSize: 100, search: "Erdene" });
  });

  it("accepts only supported profile photos within the private bucket limit", () => {
    expect(profilePhotoFileSchema.safeParse(new File(["photo"], "officer.png", { type: "image/png" })).success).toBe(true);
    expect(profilePhotoFileSchema.safeParse(new File(["photo"], "officer.gif", { type: "image/gif" })).success).toBe(false);
    expect(profilePhotoFileSchema.safeParse(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "officer.jpg", { type: "image/jpeg" })).success).toBe(false);
  });
});
