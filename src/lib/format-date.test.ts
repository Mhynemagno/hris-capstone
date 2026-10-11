import { describe, expect, it } from "vitest";

import { manilaLocalToIso } from "./format-date";

describe("manilaLocalToIso", () => {
  it("reads a date-time picker value as Philippine time", () => {
    expect(manilaLocalToIso("2026-10-18T06:00")).toBe("2026-10-17T22:00:00.000Z");
    expect(manilaLocalToIso("")).toBeNull();
  });
});
