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
    expect(employeeNumberSchema.parse("1-23456")).toBe("1-23456");
    expect(employeeNumberSchema.parse(" 0-00001 ")).toBe("0-00001");
    for (const invalid of ["123456", "12-3456", "1-2345", "1-234567", "A-23456", "PAT-0001"]) {
      expect(() => employeeNumberSchema.parse(invalid)).toThrow();
    }
  });
});
