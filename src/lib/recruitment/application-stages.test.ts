import { describe, expect, it } from "vitest";

import { formatApplicantNumber } from "./applicant-number";
import { endedAtStage, PIPELINE_STAGES, stageActions, stageBadgeVariant, trackerPosition } from "./application-stages";

describe("application stages", () => {
  it.each([
    ["Application Submission", { kind: "advance", next: ["Physical Agility Test"], canReject: false }],
    ["Physical Agility Test", { kind: "advance", next: ["Physical & Medical Examination"], canReject: false }],
    ["Final Evaluation", { kind: "advance", next: ["Shortlisted"], canReject: true }],
    ["Shortlisted", { kind: "hire", canReject: false }],
    ["Hired", { kind: "closed" }],
    ["Not Selected", { kind: "closed" }],
  ] as const)("%s offers the right actions", (status, expected) => {
    expect(stageActions(status)).toEqual(expected);
  });

  it("uses the eight PDF stages in order", () => {
    expect(PIPELINE_STAGES).toEqual([
      "Application Submission", "Physical Agility Test", "Physical & Medical Examination", "Neuro-Psychiatric Examination",
      "Drug Test", "Character & Background Investigation", "Panel Interview", "Final Evaluation",
    ]);
  });

  it("colours only the stages that need attention or are final", () => {
    expect(stageBadgeVariant("Application Submission")).toBe("info");
    expect(stageBadgeVariant("Panel Interview")).toBe("neutral");
    expect(stageBadgeVariant("Shortlisted")).toBe("success");
    expect(stageBadgeVariant("Hired")).toBe("success");
    expect(stageBadgeVariant("Not Selected")).toBe("danger");
  });

  it("finds where a rejected application stopped and positions the tracker", () => {
    const history = [
      { previous_status: null, next_status: "Application Submission" as const },
      { previous_status: "Application Submission" as const, next_status: "Physical Agility Test" as const },
      { previous_status: "Physical Agility Test" as const, next_status: "Physical Agility Test" as const },
      { previous_status: "Physical Agility Test" as const, next_status: "Not Selected" as const },
    ];
    expect(endedAtStage(history)).toBe("Physical Agility Test");
    expect(trackerPosition("Not Selected", "Physical Agility Test")).toEqual({ reached: 1, outcome: "not-selected" });
    expect(trackerPosition("Panel Interview")).toEqual({ reached: 6, outcome: "open" });
    expect(trackerPosition("Shortlisted")).toEqual({ reached: 7, outcome: "shortlisted" });
    expect(trackerPosition("Hired")).toEqual({ reached: 7, outcome: "hired" });
  });

  it("formats applicant numbers in the 0-00000 style", () => {
    expect(formatApplicantNumber(12345)).toBe("0-12345");
    expect(formatApplicantNumber(null)).toBeNull();
  });
});
