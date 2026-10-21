import { describe, expect, it } from "vitest";

import { formatAttendanceTime, formatAttendanceTimeWithMeridiem, workedDuration } from "./attendance-time";

describe("formatAttendanceTime", () => {
  it("shows the time in the attendance timezone rather than UTC", () => {
    expect(formatAttendanceTime("2026-09-25T00:05:00+00:00")).toBe("08:05");
    expect(formatAttendanceTime(null)).toBe("—");
  });

  it("keeps a 24-hour time while also making the AM/PM context explicit", () => {
    expect(formatAttendanceTimeWithMeridiem("2026-09-25T00:05:00+00:00")).toBe("08:05 (AM)");
    expect(formatAttendanceTimeWithMeridiem("2026-09-25T13:05:00+00:00")).toBe("21:05 (PM)");
  });

  it("calculates duration only for a valid completed time-in/time-out pair", () => {
    expect(workedDuration("2026-09-25T00:05:00+00:00", "2026-09-25T08:35:00+00:00")).toBe("8h 30m");
    expect(workedDuration("2026-09-25T08:35:00+00:00", "2026-09-25T00:05:00+00:00")).toBe("—");
    expect(workedDuration("2026-09-25T00:05:00+00:00", null)).toBe("—");
  });
});
