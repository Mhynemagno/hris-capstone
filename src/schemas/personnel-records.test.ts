import { describe, expect, it } from "vitest";

import {
  certificationSchema,
  employeeDirectoryFiltersSchema,
  employeeSchema,
  serviceHistorySchema,
  trainingRecordSchema,
} from "./personnel-records";

describe("personnel record schemas", () => {
  it("normalizes an official employee record before it reaches the database", () => {
    expect(
      employeeSchema.parse({
        employeeNumber: " emp-0001 ",
        firstName: " Erdene ",
        lastName: " Bat ",
        personalEmail: "EMPLOYEE@EXAMPLE.COM ",
        employmentStatus: "active",
        employmentStartedOn: "2024-01-01",
      }),
    ).toMatchObject({
      employeeNumber: "EMP-0001",
      firstName: "Erdene",
      personalEmail: "employee@example.com",
    });
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
});
