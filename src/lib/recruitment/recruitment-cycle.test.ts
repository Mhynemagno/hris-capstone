import { describe, expect, it } from "vitest";

import { deadlineWithinCycle, formatRecruitmentCycle, openingRecruitmentCycle, recruitmentCycleEnd, recruitmentCycleOf } from "./recruitment-cycle";

describe("recruitment cycles", () => {
  it("splits the year into January–June and July–December in Philippine time", () => {
    expect(recruitmentCycleOf("2026-06-30")).toEqual({ cycle: 1, year: 2026 });
    expect(recruitmentCycleOf("2026-07-01")).toEqual({ cycle: 2, year: 2026 });
    // 16:30 UTC on June 30 is already July 1 in Manila.
    expect(recruitmentCycleOf("2026-06-30T16:30:00Z")).toEqual({ cycle: 2, year: 2026 });
  });

  it("formats the cycle with its months and year", () => {
    expect(formatRecruitmentCycle({ cycle: 1, year: 2026 })).toBe("Cycle 1 · January–June 2026");
    expect(formatRecruitmentCycle({ cycle: 2, year: 2027 })).toBe("Cycle 2 · July–December 2027");
  });

  it("uses the stored cycle, falling back to the opening date", () => {
    expect(openingRecruitmentCycle({ recruitment_cycle: 1, recruitment_year: 2025, published_at: "2026-09-01T00:00:00Z" })).toEqual({ cycle: 1, year: 2025 });
    expect(openingRecruitmentCycle({ published_at: "2026-09-01T00:00:00Z" })).toEqual({ cycle: 2, year: 2026 });
    expect(openingRecruitmentCycle({ published_at: null }, new Date("2026-03-01T00:00:00+08:00"))).toEqual({ cycle: 1, year: 2026 });
  });

  it("keeps a deadline on or before the end of the cycle", () => {
    expect(recruitmentCycleEnd({ cycle: 1, year: 2026 })).toBe("2026-06-30");
    expect(recruitmentCycleEnd({ cycle: 2, year: 2026 })).toBe("2026-12-31");
    expect(deadlineWithinCycle("2026-06-30", { cycle: 1, year: 2026 })).toBe(true);
    expect(deadlineWithinCycle("2026-07-01", { cycle: 1, year: 2026 })).toBe(false);
  });
});
