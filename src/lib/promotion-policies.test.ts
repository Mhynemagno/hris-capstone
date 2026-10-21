import { describe, expect, it } from "vitest";

import { OFFICIAL_PROMOTION_POLICIES } from "./promotion-policies";

describe("official promotion policies", () => {
  it("preserves the three PDF rank bands and their fixed 100-point allocations", () => {
    expect(OFFICIAL_PROMOTION_POLICIES.map((policy) => policy.rankBand)).toEqual(["PLT–PLTCOL", "PSMS–PEMS", "PCPL–PMSG"]);
    OFFICIAL_PROMOTION_POLICIES.forEach((policy) => expect(policy.criteria.reduce((total, criterion) => total + criterion.points, 0)).toBe(100));
  });
});
