import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationStatusTracker, applicationStatusSteps, historyEntryLabel } from "./application-status-tracker";

const states = (status: Parameters<typeof applicationStatusSteps>[0]) => applicationStatusSteps(status).map((step) => `${step.label}:${step.state}`);

describe("applicationStatusSteps", () => {
  it("shows a new application as submitted with the whole cycle still ahead", () => {
    expect(states("Submitted")).toEqual([
      "Application Submitted:done",
      "Under Review:waiting",
      "For Interview:waiting",
      "Endorsed to Crame:waiting",
      "Neuro Exam:waiting",
      "For Training:waiting",
    ]);
  });

  it("treats shortlisting and revisions as part of the review", () => {
    for (const status of ["Under Review", "Shortlisted", "Needs Revision"] as const) {
      expect(states(status).slice(0, 3)).toEqual(["Application Submitted:done", "Under Review:waiting", "For Interview:waiting"]);
    }
    expect(applicationStatusSteps("Needs Revision")[1]?.detail).toMatch(/revise/);
  });

  it("continues past the interview to Crame, the neuro exam and training", () => {
    expect(applicationStatusSteps("Interview")[2]?.detail).toBe("Your requirements are complete. You are now for interview.");
    expect(states("Endorsed to Crame").slice(2, 5)).toEqual(["For Interview:done", "Endorsed to Crame:waiting", "Neuro Exam:waiting"]);
    expect(applicationStatusSteps("Endorsed to Crame")[3]?.detail).toMatch(/BMI/);
    expect(states("For Training").slice(4)).toEqual(["Neuro Exam:done", "For Training:waiting"]);
  });

  it("adds the final outcome once HR decides", () => {
    expect(states("Hired")).toEqual([
      "Application Submitted:done",
      "Under Review:done",
      "For Interview:done",
      "Endorsed to Crame:done",
      "Neuro Exam:done",
      "For Training:done",
      "Approved — Hired:done",
    ]);
    expect(states("Not Selected")).toEqual(["Application Submitted:done", "Rejected — Not Selected:rejected"]);
  });
});

describe("historyEntryLabel", () => {
  it("names a history row that keeps the status a remark", () => {
    expect(historyEntryLabel({ previous_status: "Endorsed to Crame", next_status: "Endorsed to Crame" })).toBe("Remark");
    expect(historyEntryLabel({ previous_status: "Interview", next_status: "Endorsed to Crame" })).toBe("Endorsed to Crame");
  });
});

describe("ApplicationStatusTracker", () => {
  it("renders a vertical list with an announced state for each step", () => {
    render(<ApplicationStatusTracker status="Not Selected" />);
    const items = within(screen.getByRole("list", { name: "Application progress" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Application Submitted (Completed)");
    expect(items[1]).toHaveTextContent("Rejected — Not Selected (Rejected)");
    expect(items[1]).toHaveAttribute("data-state", "rejected");
  });
});
