import { describe, expect, it } from "vitest";

import {
  appRoleSchema,
  employeeNumberSchema,
  paginationSchema,
  uuidSchema,
} from "./common";

describe("shared foundation schemas", () => {
  it("accepts only the five application roles", () => {
    expect(appRoleSchema.parse("system_administrator")).toBe(
      "system_administrator",
    );
    expect(() => appRoleSchema.parse("superuser")).toThrow();
  });

  it("validates UUIDs, pagination, and employee numbers", () => {
    expect(uuidSchema.parse("00000000-0000-4000-8000-000000000001")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(paginationSchema.parse({ page: 2, pageSize: 25 })).toEqual({
      page: 2,
      pageSize: 25,
    });
    expect(employeeNumberSchema.parse("EMP-2026-001")).toBe("EMP-2026-001");
    expect(() => employeeNumberSchema.parse("employee 1")).toThrow();
  });
});
