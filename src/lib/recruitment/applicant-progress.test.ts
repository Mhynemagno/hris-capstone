import { describe, expect, it } from "vitest";

import { nextAction, progressTimeline, scheduleParts, STAGE_SHORT_LABELS, stageProgress } from "./applicant-progress";

describe("applicant progress", () => {
  it("counts the stage reached", () => {
    expect(stageProgress(null)).toBe(0);
    expect(stageProgress("Application Submission")).toBe(1);
    expect(stageProgress("Physical Agility Test")).toBe(2);
    expect(stageProgress("Final Evaluation")).toBe(8);
    expect(stageProgress("Hired")).toBe(8);
    expect(stageProgress("Not Selected")).toBe(8);
  });

  it("uses the mockup's short stage names", () => {
    expect(Object.values(STAGE_SHORT_LABELS)).toEqual([
      "Application Submission", "Physical Agility Test", "Physical & Medical Exam", "Neuro-Psychiatric Exam",
      "Drug Test", "Background Investigation", "Panel Interview", "Final Evaluation",
    ]);
  });

  it("formats a schedule in Philippine time", () => {
    expect(scheduleParts("2026-10-17T22:00:00Z")).toEqual({ date: "October 18, 2026", time: "6:00 AM" });
    expect(scheduleParts(null)).toBeNull();
  });

  it("asks for documents before an application exists", () => {
    expect(nextAction(null)).toEqual({ title: "Upload your required documents", detail: "Upload all five documents, then press Save to submit your application.", href: "/applicant/documents" });
  });

  it("shows a scheduled stage with its date, time and venue", () => {
    expect(nextAction({ status: "Physical Agility Test", stage_result: "scheduled", stage_scheduled_at: "2026-10-17T22:00:00Z", stage_venue: "Grandstand Sports Complex" }))
      .toEqual({ title: "Physical Agility Test Attendance", detail: "Scheduled on October 18, 2026 (6:00 AM) at Grandstand Sports Complex.", href: "/applicant/applications" });
  });

  it("falls back to the stage's message", () => {
    expect(nextAction({ status: "Drug Test", stage_result: "pending", stage_scheduled_at: null, stage_venue: null }))
      .toEqual({ title: "Drug Test", detail: "You are now scheduled for the drug test.", href: "/applicant/applications" });
    expect(nextAction({ status: "Application Submission", stage_result: "pending", stage_scheduled_at: null, stage_venue: null }).title).toBe("Application under review");
  });

  it("states the outcome once the process is over", () => {
    expect(nextAction({ status: "Hired", stage_result: "pending", stage_scheduled_at: null, stage_venue: null }).detail).toBe("Congratulations! HR will contact you about the next steps.");
  });

  it("builds the progress timeline: done stages with their date, the current one, and the next two", () => {
    const history = [
      { previous_status: null, next_status: "Application Submission" as const, created_at: "2026-10-09T02:00:00Z" },
      { previous_status: "Application Submission" as const, next_status: "Physical Agility Test" as const, created_at: "2026-10-10T02:00:00Z" },
    ];
    expect(progressTimeline("Physical Agility Test", history)).toEqual([
      { label: "Application Submission", state: "done", detail: "Completed & Verified on October 10, 2026." },
      { label: "Physical Agility Test", state: "current", detail: "You are now scheduled for the physical agility test." },
      { label: "Physical & Medical Examination", state: "upcoming", detail: "Pending physical agility test evaluation." },
      { label: "Neuro-Psychiatric Examination", state: "upcoming", detail: "Scheduled upon medical clearance." },
    ]);
  });

  it("starts the timeline at document upload before an application exists", () => {
    expect(progressTimeline(null, [])[0]).toEqual({ label: "Application Submission", state: "current", detail: "Upload your required documents to start." });
  });
});
