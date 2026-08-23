import { describe, expect, it } from "vitest";

import { attendanceFiltersSchema, attendanceMappingSchema, attendanceSettingsSchema } from "./attendance-integration";

const employeeId = "123e4567-e89b-42d3-a456-426614174000";

describe("attendance integration schemas", () => {
  it("normalizes a one-day history filter", () => {
    expect(attendanceFiltersSchema.parse({ startsOn: "2026-08-24", endsOn: "2026-08-24", page: "2", pageSize: "25" })).toEqual({ startsOn: "2026-08-24", endsOn: "2026-08-24", page: 2, pageSize: 25 });
  });

  it("rejects reversed dates and page sizes over 100", () => {
    expect(attendanceFiltersSchema.safeParse({ startsOn: "2026-08-25", endsOn: "2026-08-24" }).success).toBe(false);
    expect(attendanceFiltersSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("allows only administrator-managed attendance settings", () => {
    expect(attendanceSettingsSchema.parse({ workdayStart: "08:00", lateGraceMinutes: 15, templateVersion: "v1", isEnabled: true })).toEqual({ workdayStart: "08:00", lateGraceMinutes: 15, templateVersion: "v1", isEnabled: true });
    expect(attendanceSettingsSchema.safeParse({ workdayStart: "08:00", lateGraceMinutes: 121, timezone: "UTC" }).success).toBe(false);
  });

  it("normalizes external employee IDs and requires UUID references", () => {
    expect(attendanceMappingSchema.parse({ employeeId, externalEmployeeId: " dev-001 " })).toEqual({ employeeId, externalEmployeeId: "DEV-001" });
    expect(attendanceMappingSchema.safeParse({ employeeId: "dev-001", externalEmployeeId: "DEV-001" }).success).toBe(false);
  });
});
