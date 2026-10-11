import { describe, expect, it } from "vitest";
import { aiMatchLabel, applicationStatusPill, ATTENDANCE_STATUS, DEPLOYMENT_STATUS, LEAVE_STATUS } from "./status-maps";

describe("staff status maps", () => {
  it("labels leave as in leave.html", () => {
    expect(LEAVE_STATUS.pending).toEqual({ label: "For Approval", tone: "amber" });
    expect(LEAVE_STATUS.cancelled).toEqual({ label: "Cancelled", tone: "slate" });
  });
  it("labels deployments and attendance", () => {
    expect(DEPLOYMENT_STATUS.ongoing).toEqual({ label: "Ongoing", tone: "blue" });
    expect(ATTENDANCE_STATUS.incomplete).toEqual({ label: "Partial", tone: "amber" });
    expect(ATTENDANCE_STATUS.late.tone).toBe("rose");
  });
  it("labels the roster", () => {
    expect(applicationStatusPill("Pending")).toEqual({ label: "Pending", tone: "amber" });
    expect(applicationStatusPill("Application Submission")).toEqual({ label: "Pending / For Evaluation", tone: "amber" });
    expect(applicationStatusPill("Drug Test")).toEqual({ label: "Drug Test", tone: "blue" });
    expect(applicationStatusPill("Hired").tone).toBe("emerald");
    expect(applicationStatusPill("Not Selected").tone).toBe("rose");
  });
  it("names AI match scores", () => {
    expect(aiMatchLabel(5)).toBe("Excellent Match");
    expect(aiMatchLabel(4)).toBe("Good Match");
    expect(aiMatchLabel(3)).toBe("Fair Match");
    expect(aiMatchLabel(1)).toBe("Low Match");
    expect(aiMatchLabel(null)).toBeNull();
  });
});
