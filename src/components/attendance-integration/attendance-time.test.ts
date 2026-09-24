import { describe, expect, it } from "vitest";

import { formatAttendanceTime } from "./attendance-time";

describe("formatAttendanceTime", () => {
  it("shows the time in the attendance timezone rather than UTC", () => {
    expect(formatAttendanceTime("2026-09-25T00:05:00+00:00")).toBe("08:05");
    expect(formatAttendanceTime(null)).toBe("—");
  });
});
