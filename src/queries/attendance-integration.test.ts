import { describe, expect, it } from "vitest";

import { attendanceFilters } from "./attendance-integration";

describe("attendance integration queries", () => {
  it("validates filters before requesting protected attendance data", () => {
    expect(attendanceFilters({ page: "2", pageSize: "25", status: "late" })).toEqual({ page: 2, pageSize: 25, status: "late" });
  });
});
