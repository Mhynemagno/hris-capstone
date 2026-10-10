import { describe, expect, it } from "vitest";

import { applicationStatusLabel, needsStageDocument, stageResultActions, stageResultHistoryLabel } from "./stage-results";

describe("applicationStatusLabel", () => {
  it("uses the client's status words", () => {
    expect(applicationStatusLabel("Physical Agility Test", "pending").label).toBe("Pending / For Evaluation");
    expect(applicationStatusLabel("Application Submission", "verified").label).toBe("Verified");
    expect(applicationStatusLabel("Drug Test", "scheduled").label).toBe("Scheduled");
    expect(applicationStatusLabel("Not Selected", "pending")).toMatchObject({ label: "Disqualified", variant: "danger" });
    expect(applicationStatusLabel("Shortlisted", "pending")).toMatchObject({ label: "Candidate", variant: "success" });
    expect(applicationStatusLabel("Hired", "pending").label).toBe("Hired");
  });
});

describe("stageResultActions", () => {
  it("offers Verified, Passed and Failed at Application Submission", () => {
    expect(stageResultActions("Application Submission", "pending")).toEqual(["verified", "passed", "failed"]);
    expect(stageResultActions("Application Submission", "verified")).toEqual(["passed", "failed"]);
  });

  it("offers Scheduled, Passed and Failed at the test stages and Final Evaluation", () => {
    expect(stageResultActions("Panel Interview", "pending")).toEqual(["scheduled", "passed", "failed"]);
    expect(stageResultActions("Final Evaluation", "scheduled")).toEqual(["passed", "failed"]);
  });

  it("offers nothing once the application has left the process", () => {
    expect(stageResultActions("Shortlisted", "pending")).toEqual([]);
    expect(stageResultActions("Not Selected", "pending")).toEqual([]);
    expect(stageResultActions("Hired", "pending")).toEqual([]);
  });
});

describe("needsStageDocument", () => {
  it("asks for proof when passing or failing any stage after Application Submission", () => {
    expect(needsStageDocument("Application Submission", "passed")).toBe(false);
    expect(needsStageDocument("Drug Test", "passed")).toBe(true);
    expect(needsStageDocument("Drug Test", "failed")).toBe(true);
    expect(needsStageDocument("Drug Test", "scheduled")).toBe(false);
  });
});

describe("stageResultHistoryLabel", () => {
  it("describes recorded results", () => {
    expect(stageResultHistoryLabel({ previous_status: "Drug Test", next_status: "Character & Background Investigation", result: "passed" })).toBe("Passed: Drug Test");
    expect(stageResultHistoryLabel({ previous_status: "Drug Test", next_status: "Not Selected", result: "failed" })).toBe("Failed: Drug Test");
    expect(stageResultHistoryLabel({ previous_status: "Panel Interview", next_status: "Panel Interview", result: "scheduled" })).toBe("Scheduled: Panel Interview");
    expect(stageResultHistoryLabel({ previous_status: "Application Submission", next_status: "Application Submission", result: "verified" })).toBe("Documents verified");
    expect(stageResultHistoryLabel({ previous_status: "Panel Interview", next_status: "Final Evaluation", result: null })).toBeNull();
  });
});
