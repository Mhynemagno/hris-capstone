import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationStatusTracker, applicationStatusSteps, historyEntryLabel } from "./application-status-tracker";

const states = (status: Parameters<typeof applicationStatusSteps>[0]) => applicationStatusSteps(status).map((step) => `${step.label}:${step.state}`);

describe("applicationStatusSteps", () => {
  it("shows all eight PDF stages for a new application", () => {
    expect(states("Application Submission")).toEqual([
      "Application Submission:done",
      "Physical Agility Test:waiting",
      "Physical & Medical Examination:waiting",
      "Neuro-Psychiatric Examination:waiting",
      "Drug Test:waiting",
      "Character & Background Investigation:waiting",
      "Panel Interview:waiting",
      "Final Evaluation:waiting",
    ]);
  });

  it("completes all eight stages before showing a shortlisted outcome", () => {
    expect(states("Shortlisted").slice(0, 8)).toEqual([
      "Application Submission:done", "Physical Agility Test:done", "Physical & Medical Examination:done", "Neuro-Psychiatric Examination:done",
      "Drug Test:done", "Character & Background Investigation:done", "Panel Interview:done", "Final Evaluation:done",
    ]);
    expect(applicationStatusSteps("Shortlisted").at(-1)).toEqual(expect.objectContaining({ label: "SHORTLISTED", state: "done" }));
    expect(applicationStatusSteps("Not Selected").at(-1)).toEqual(expect.objectContaining({ label: "NOT SELECTED", state: "rejected" }));
  });
});

describe("historyEntryLabel", () => {
  it("names a history row that keeps the status a remark", () => {
    expect(historyEntryLabel({ previous_status: "Physical Agility Test", next_status: "Physical Agility Test" })).toBe("Remark");
    expect(historyEntryLabel({ previous_status: "Panel Interview", next_status: "Final Evaluation" })).toBe("Final Evaluation");
  });
});

describe("ApplicationStatusTracker", () => {
  it("renders a vertical list with an announced state for each step", () => {
    render(<ApplicationStatusTracker status="Not Selected" />);
    const items = within(screen.getByRole("list", { name: "Application progress" })).getAllByRole("listitem");
    expect(items).toHaveLength(9);
    expect(items[0]).toHaveTextContent("Application Submission (Completed)");
    expect(items[8]).toHaveTextContent("NOT SELECTED (Rejected)");
    expect(items[8]).toHaveAttribute("data-state", "rejected");
  });
  it("tells the applicant their application is under final deliberation", () => {
    const finalStep = applicationStatusSteps("Final Evaluation").find((step) => step.label === "Final Evaluation");
    expect(finalStep?.detail).toBe("Under Final Deliberation");
  });
  it("names HR's recorded results in the applicant's history", () => {
    expect(historyEntryLabel({ previous_status: "Drug Test", next_status: "Character & Background Investigation", result: "passed" })).toBe("Passed: Drug Test");
    expect(historyEntryLabel({ previous_status: "Panel Interview", next_status: "Panel Interview", result: "scheduled" })).toBe("Scheduled: Panel Interview");
  });
});
