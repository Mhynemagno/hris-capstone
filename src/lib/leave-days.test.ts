import { describe, expect, it } from "vitest";

import { dayCount, excessLeaveDays, leaveDays, remainingLeaveDays } from "./leave-days";

describe("leave days", () => {
  it("counts inclusive calendar days", () => {
    expect(leaveDays("2026-10-05", "2026-10-05")).toBe(1);
    expect(leaveDays("2026-10-05", "2026-10-06")).toBe(2);
    expect(leaveDays("2026-12-31", "2027-01-02")).toBe(3);
  });

  it("words a day count", () => {
    expect(dayCount(1)).toBe("1 day");
    expect(dayCount(2)).toBe("2 days");
  });

  it("finds the remaining credits and the excess days to deduct", () => {
    expect(remainingLeaveDays(undefined)).toBeNull();
    expect(remainingLeaveDays({ days_per_year: null, used_days: 4 })).toBeNull();
    expect(remainingLeaveDays({ days_per_year: 2, used_days: 3 })).toBe(0);
    expect(excessLeaveDays(3, 1)).toBe(2);
    expect(excessLeaveDays(1, 2)).toBe(0);
    expect(excessLeaveDays(5, null)).toBe(0);
  });
});
