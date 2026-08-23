import { describe, expect, it } from "vitest";

import * as schemas from "./index";

const validJob = {
  title: "Recruitment Officer",
  departmentId: 1,
  positionId: 2,
  description: "Coordinate candidate sourcing, screening, and recruitment records.",
  location: "Ulaanbaatar",
  closesOn: "2026-10-01",
  status: "draft",
  criteria: [
    {
      ordinal: 1,
      kind: "education",
      requirement: "Bachelor degree",
      isRequired: true,
    },
  ],
};

describe("recruitment schemas", () => {
  it("accepts a normalized draft opening with ordered qualification criteria", () => {
    const recruitment = schemas as typeof schemas & {
      jobOpeningSchema: { parse: (input: unknown) => unknown };
    };

    expect(recruitment.jobOpeningSchema).toBeDefined();
    expect(recruitment.jobOpeningSchema.parse(validJob)).toMatchObject({
      title: "Recruitment Officer",
      criteria: [{ ordinal: 1, isRequired: true }],
    });
  });
});
