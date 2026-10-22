import { describe, expect, it } from "vitest";

import { OFFICIAL_PROMOTION_POLICIES, PROMOTION_SCORECARD_POLICIES } from "./promotion-policies";

describe("official promotion policies", () => {
  it("preserves the three PDF rank bands and their fixed 100-point allocations", () => {
    expect(OFFICIAL_PROMOTION_POLICIES.map((policy) => policy.rankBand)).toEqual(["PLT–PLTCOL", "PSMS–PEMS", "PCPL–PMSG"]);
    OFFICIAL_PROMOTION_POLICIES.forEach((policy) => expect(policy.criteria.reduce((total, criterion) => total + criterion.points, 0)).toBe(100));
  });

  it("lists eligibility as an unscored qualifying requirement in every band", () => {
    OFFICIAL_PROMOTION_POLICIES.forEach((policy) => expect(policy.qualifyingRequirements).toEqual([expect.objectContaining({ label: "Eligibility", detail: expect.stringContaining("NAPOLCOM") })]));
  });

  it("exposes the complete PDF scoring rows for each fixed rank band", () => {
    const pcpl = PROMOTION_SCORECARD_POLICIES["PCPL-PMSG"];
    const senior = PROMOTION_SCORECARD_POLICIES["PSMS-PEMS"];
    const officer = PROMOTION_SCORECARD_POLICIES["PLT-PLTCOL"];

    expect(pcpl.allocation).toEqual({ seniority: 30, assignment: 20, awards: 10, iper: 5, board: 15, reputation: 20 });
    expect(senior.allocation).toEqual({ seniority: 25, assignment: 25, awards: 10, iper: 5, board: 10, reputation: 25 });
    expect(officer.allocation).toEqual({ seniority: 25, assignment: 25, awards: 10, iper: 5, board: 10, reputation: 25 });
    expect(pcpl.seniorityRows.at(-1)).toMatchObject({ minimum: { years: 7, months: 6, days: 1 }, points: 30 });
    expect(senior.seniorityRows.at(-1)).toMatchObject({ minimum: { years: 7, months: 0, days: 0 }, points: 25 });
    expect(pcpl.iperPairs).toEqual(expect.arrayContaining([
      { ratings: ["Outstanding", "Outstanding"], points: 5 },
      { ratings: ["Outstanding", "Very Satisfactory"], points: 3.5 },
      { ratings: ["Very Satisfactory", "Very Satisfactory"], points: 2 },
    ]));
  });
});
