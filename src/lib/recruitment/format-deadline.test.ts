import { describe, expect, it } from "vitest";

import { formatDeadline } from "./format-deadline";

describe("formatDeadline", () => {
  it("uses the long month format without a time-zone shift", () => {
    expect(formatDeadline("2026-09-29")).toBe("September 29, 2026");
    expect(formatDeadline("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns null for a missing deadline", () => {
    expect(formatDeadline(null)).toBeNull();
  });
});
