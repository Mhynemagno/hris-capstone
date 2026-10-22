import { describe, expect, it } from "vitest";

import { eligibilityLabel, formatRating } from "./eligibility";

describe("eligibility labels", () => {
  it("shows the rating as a percent after the eligibility name", () => {
    expect(eligibilityLabel({ name: "NAPOLCOM PNP Entrance Examination", rating: 85 })).toBe("NAPOLCOM PNP Entrance Examination — 85%");
    expect(formatRating("82.50")).toBe("82.5%");
  });

  it("shows only the name when no rating is recorded", () => {
    expect(eligibilityLabel({ name: "Career Service Professional", rating: null })).toBe("Career Service Professional");
    expect(eligibilityLabel({ name: "Career Service Professional" })).toBe("Career Service Professional");
  });
});
