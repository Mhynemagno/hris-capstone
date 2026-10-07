import { expect, it } from "vitest";

import { resolvePeriod } from "./date-range";

const today = new Date("2026-10-08T03:00:00Z");

it("resolves presets ending today", () => {
  expect(resolvePeriod({ period: "7d", from: "", to: "" }, today)).toEqual({ preset: "7d", startsOn: "2026-10-02", endsOn: "2026-10-08" });
  expect(resolvePeriod({ period: "", from: "", to: "" }, today)).toEqual({ preset: "30d", startsOn: "2026-09-09", endsOn: "2026-10-08" });
  expect(resolvePeriod({ period: "month", from: "", to: "" }, today)).toEqual({ preset: "month", startsOn: "2026-10-01", endsOn: "2026-10-08" });
});

it("accepts a valid custom range and falls back on junk", () => {
  expect(resolvePeriod({ period: "custom", from: "2026-01-01", to: "2026-01-31" }, today)).toEqual({ preset: "custom", startsOn: "2026-01-01", endsOn: "2026-01-31" });
  expect(resolvePeriod({ period: "custom", from: "2026-02-01", to: "2026-01-01" }, today).preset).toBe("30d");
  expect(resolvePeriod({ period: "custom", from: "nope", to: "" }, today).preset).toBe("30d");
  expect(resolvePeriod({ period: "weird", from: "", to: "" }, today).preset).toBe("30d");
});

it("uses the Philippine calendar day, not the UTC one", () => {
  // 00:30 on October 8 in Manila is still October 7 in UTC.
  expect(resolvePeriod({ period: "7d", from: "", to: "" }, new Date("2026-10-07T16:30:00Z"))).toEqual({ preset: "7d", startsOn: "2026-10-02", endsOn: "2026-10-08" });
});
