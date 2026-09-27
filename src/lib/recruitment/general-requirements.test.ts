import { describe, expect, it } from "vitest";

import { criteriaFromGeneralRequirements, generalRequirementsFromCriteria, groupGeneralRequirements } from "./general-requirements";

const saved = (ordinal: number, kind: "education" | "eligibility" | "skill" | "other", requirement: string, isRequired = true) => ({ ordinal, kind, requirement, is_required: isRequired });

describe("General Requirements", () => {
  it("starts a new opening with every other requirement checked", () => {
    expect(generalRequirementsFromCriteria()).toEqual({
      education: { choice: "", other: "" },
      eligibility: { choice: "", other: "" },
      otherRequirements: [
        { kind: "other", requirement: "Filipino Citizen", included: true, isRequired: true },
        { kind: "other", requirement: "No pending criminal case", included: true, isRequired: true },
        { kind: "other", requirement: "Minimum height requirement", included: true, isRequired: true },
      ],
    });
  });

  it("round-trips the chosen requirements, typed Others and checked items as ordered criteria", () => {
    const values = generalRequirementsFromCriteria();
    values.education = { choice: "Others", other: " Master's Degree " };
    values.eligibility = { choice: "Licensed Criminologist", other: "" };
    values.otherRequirements[1]!.included = false;

    const criteria = criteriaFromGeneralRequirements(values);
    expect(criteria).toEqual([
      { ordinal: 1, kind: "education", requirement: "Master's Degree", isRequired: true },
      { ordinal: 2, kind: "eligibility", requirement: "Licensed Criminologist", isRequired: true },
      { ordinal: 3, kind: "other", requirement: "Filipino Citizen", isRequired: true },
      { ordinal: 4, kind: "other", requirement: "Minimum height requirement", isRequired: true },
    ]);

    const reopened = generalRequirementsFromCriteria(criteria.map((criterion) => saved(criterion.ordinal, criterion.kind as "education", criterion.requirement)));
    expect(reopened.education.choice).toBe("Master's Degree");
    expect(reopened.eligibility.choice).toBe("Licensed Criminologist");
    expect(reopened.otherRequirements.map((item) => item.included)).toEqual([true, false, true]);
  });

  it("keeps older criteria: listed wording is matched and unlisted ones stay checked", () => {
    const values = generalRequirementsFromCriteria([
      saved(3, "skill", "Firearms handling", false),
      saved(1, "education", "baccalaureate degree"),
      saved(2, "education", "Master's degree"),
    ]);
    expect(values.education.choice).toBe("Baccalaureate Degree");
    expect(values.eligibility.choice).toBe("");
    expect(values.otherRequirements.slice(3)).toEqual([
      { kind: "education", requirement: "Master's degree", included: true, isRequired: true },
      { kind: "skill", requirement: "Firearms handling", included: true, isRequired: false },
    ]);
  });

  it("groups saved criteria for display", () => {
    const grouped = groupGeneralRequirements([saved(3, "skill", "Firearms handling"), saved(2, "other", "Filipino Citizen"), saved(1, "education", "Baccalaureate Degree")]);
    expect(grouped.education.map((criterion) => criterion.requirement)).toEqual(["Baccalaureate Degree"]);
    expect(grouped.eligibility).toEqual([]);
    expect(grouped.others.map((item) => item.label)).toEqual(["Filipino Citizen", "Skill: Firearms handling"]);
  });
});
