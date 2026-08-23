import { describe, expect, it } from "vitest";

import { promotionEvaluationFilters } from "./promotion-eligibility";

describe("promotion eligibility queries", () => {
  it("normalizes bounded HR directory filters before requesting data", () => {
    expect(promotionEvaluationFilters({ page: "2", pageSize: "200", readiness: "ready", recommendation: "recommended" })).toEqual({
      page: 2,
      pageSize: 100,
      readiness: "ready",
      recommendation: "recommended",
    });
  });
});
