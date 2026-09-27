import { describe, expect, it } from "vitest";

import * as schemas from "./index";

const validJob = {
  title: "Recruitment Officer",
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

  it("requires a title, a location, and a deadline of application, but no department or rank", () => {
    const parsed = schemas.jobOpeningSchema.parse(validJob);
    expect(parsed).not.toHaveProperty("departmentId");
    expect(parsed).not.toHaveProperty("rankId");
    for (const field of ["title", "location", "closesOn"] as const) {
      const result = schemas.jobOpeningSchema.safeParse({ ...validJob, [field]: field === "closesOn" ? undefined : " " });
      expect(result.success, field).toBe(false);
    }
  });

  it("accepts the applicant personal details collected before an application", () => {
    const recruitment = schemas as typeof schemas & {
      applicantProfileSchema: { parse: (input: unknown) => unknown };
    };

    expect(
      recruitment.applicantProfileSchema.parse({
        firstName: "Maria",
        middleName: "Santos",
        lastName: "Reyes",
        qualifier: "Jr.",
        placeOfBirth: "Quezon City",
        dateOfBirth: "1998-05-16",
        gender: "female",
        civilStatus: "single",
        religion: "Roman Catholic",
        phone: "09171234567",
        address: "Quezon City",
      }),
    ).toMatchObject({
      qualifier: "Jr.",
      placeOfBirth: "Quezon City",
      dateOfBirth: "1998-05-16",
      gender: "female",
      civilStatus: "single",
      religion: "Roman Catholic",
    });
  });
});
