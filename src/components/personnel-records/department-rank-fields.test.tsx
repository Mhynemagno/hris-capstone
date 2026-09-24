import { describe, expect, it } from "vitest";

import { buildRankChoices } from "./department-rank-fields";

const stamp = { created_at: "", updated_at: "" };
const ranks = [
  { id: 2, name: "Police Corporal", code: "PCpl", sort_order: 2, is_active: false, ...stamp },
  { id: 1, name: "Patrolman / Patrolwoman", code: "Pat", sort_order: 1, is_active: true, ...stamp },
];

describe("buildRankChoices", () => {
  it("lists active ranks as code — name in seniority order", () => {
    expect(buildRankChoices(ranks, null)).toEqual([{ value: "1", label: "Pat — Patrolman / Patrolwoman" }]);
  });

  it("keeps a saved inactive rank selectable and labelled", () => {
    expect(buildRankChoices(ranks, 2)).toEqual([
      { value: "1", label: "Pat — Patrolman / Patrolwoman" },
      { value: "2", label: "PCpl — Police Corporal (inactive)" },
    ]);
  });

  it("keeps the saved rank submittable while ranks load", () => {
    expect(buildRankChoices(undefined, 5)).toEqual([{ value: "5", label: "Current rank (loading…)" }]);
  });
});
