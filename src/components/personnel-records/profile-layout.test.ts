import { describe, expect, it } from "vitest";

import { formatDay, relativeDay, serviceLength } from "./profile-layout";

const today = new Date(2026, 8, 26);

describe("profile-layout helpers", () => {
  it("formats calendar days without time-zone drift", () => {
    expect(formatDay("1982-08-16")).toBe("Aug 16, 1982");
    expect(formatDay(null)).toBeNull();
  });

  it("describes length of service in years and months", () => {
    expect(serviceLength("2017-06-01", null, today)).toBe("9 years 3 months");
    expect(serviceLength("2026-09-01", null, today)).toBe("Less than a month");
    expect(serviceLength("2020-01-15", "2021-01-15", today)).toBe("1 year");
    expect(serviceLength(undefined, null, today)).toBeNull();
  });

  it("describes dates relative to today", () => {
    expect(relativeDay("2026-09-24", today)).toBe("2 days ago");
    expect(relativeDay("2026-09-26", today)).toBe("today");
    expect(relativeDay("2026-06-26", today)).toBe("3 months ago");
    expect(relativeDay("2023-09-26", today)).toBe("3 years ago");
  });
});
