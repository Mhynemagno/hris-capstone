import { describe, expect, it } from "vitest";

import { formatApplicantNumber } from "./applicant-number";
import { endedAtStage, stageActions, stageBadgeVariant, trackerPosition } from "./application-stages";

describe("application stages", () => {
  it.each([
    ["Submitted", false, { kind: "advance", next: ["Under Review"], canReject: false }],
    ["Under Review", false, { kind: "advance", next: ["Shortlisted", "Interview"], canReject: true }],
    ["Interview", false, { kind: "advance", next: ["Endorsed to Crame", "Shortlisted"], canReject: true }],
    ["Endorsed to Crame", false, { kind: "waiting-bmi", canReject: true }],
    ["Endorsed to Crame", true, { kind: "advance", next: ["Neuro Exam"], canReject: true }],
    ["For Training", false, { kind: "hire", canReject: true }],
    ["Needs Revision", false, { kind: "waiting-resubmit" }],
    ["Hired", false, { kind: "closed" }],
    ["Not Selected", false, { kind: "closed" }],
  ] as const)("%s (BMI proof: %s) offers the right actions", (status, hasBmi, expected) => {
    expect(stageActions(status, hasBmi)).toEqual(expected);
  });

  it("colours only the stages that need attention or are final", () => {
    expect(stageBadgeVariant("Submitted")).toBe("info");
    expect(stageBadgeVariant("Interview")).toBe("neutral");
    expect(stageBadgeVariant("Needs Revision")).toBe("warning");
    expect(stageBadgeVariant("Hired")).toBe("success");
    expect(stageBadgeVariant("Not Selected")).toBe("danger");
  });

  it("finds where a rejected application stopped and positions the tracker", () => {
    const history = [
      { previous_status: null, next_status: "Submitted" as const },
      { previous_status: "Submitted" as const, next_status: "Under Review" as const },
      { previous_status: "Under Review" as const, next_status: "Under Review" as const },
      { previous_status: "Under Review" as const, next_status: "Not Selected" as const },
    ];
    expect(endedAtStage(history)).toBe("Under Review");
    expect(trackerPosition("Not Selected", "Under Review")).toEqual({ reached: 1, outcome: "not-selected" });
    expect(trackerPosition("Interview")).toEqual({ reached: 3, outcome: "open" });
    expect(trackerPosition("Needs Revision")).toEqual({ reached: 1, outcome: "needs-revision" });
    expect(trackerPosition("Hired")).toEqual({ reached: 7, outcome: "hired" });
  });

  it("formats applicant numbers in the 0-00000 style", () => {
    expect(formatApplicantNumber(12345)).toBe("0-12345");
    expect(formatApplicantNumber(null)).toBeNull();
  });
});
