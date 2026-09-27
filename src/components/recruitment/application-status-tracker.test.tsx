import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationStatusTracker, applicationStatusSteps } from "./application-status-tracker";

const states = (status: Parameters<typeof applicationStatusSteps>[0]) => applicationStatusSteps(status).map((step) => `${step.label}:${step.state}`);

describe("applicationStatusSteps", () => {
  it("shows a new application as submitted and waiting for review", () => {
    expect(states("Submitted")).toEqual(["Application Submitted:done", "Under Review:waiting", "Pending:waiting"]);
  });

  it("treats shortlisting, interviews, and revisions as part of the review", () => {
    for (const status of ["Under Review", "Shortlisted", "Interview", "Needs Revision"] as const) {
      expect(states(status)).toEqual(["Application Submitted:done", "Under Review:done", "Pending:waiting"]);
    }
    expect(applicationStatusSteps("Needs Revision")[1]?.detail).toMatch(/revise/);
  });

  it("adds the final outcome once HR decides", () => {
    expect(states("Hired")).toEqual(["Application Submitted:done", "Under Review:done", "Pending:done", "Approved — Hired:done"]);
    expect(states("Not Selected")).toEqual(["Application Submitted:done", "Under Review:done", "Pending:done", "Rejected — Not Selected:rejected"]);
  });
});

describe("ApplicationStatusTracker", () => {
  it("renders a vertical list with an announced state for each step", () => {
    render(<ApplicationStatusTracker status="Not Selected" />);
    const items = within(screen.getByRole("list", { name: "Application progress" })).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Application Submitted (Completed)");
    expect(items[3]).toHaveTextContent("Rejected — Not Selected (Rejected)");
    expect(items[3]).toHaveAttribute("data-state", "rejected");
  });
});
