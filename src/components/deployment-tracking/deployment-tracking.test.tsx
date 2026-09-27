import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeploymentStatusBadge, effectiveDeploymentStatus, manilaToday } from "./deployment-status-badge";

describe("deployment tracking presentation", () => {
  it.each([["active", "Active"], ["rejected", "Rejected"]] as const)("labels %s deployments accessibly", (status, label) => {
    render(<DeploymentStatusBadge deployment={{ status, starts_on: "2026-09-01" }} today="2026-09-27" />);
    expect(screen.getByText(label)).toBeVisible();
  });

  it("shows an active deployment that starts in the future as upcoming until its start date", () => {
    const deployment = { status: "active" as const, starts_on: "2026-09-28" };
    expect(effectiveDeploymentStatus(deployment, "2026-09-27")).toBe("upcoming");
    expect(effectiveDeploymentStatus(deployment, "2026-09-28")).toBe("active");
    expect(effectiveDeploymentStatus(deployment, "2026-10-01")).toBe("active");
    expect(effectiveDeploymentStatus({ status: "rejected", starts_on: "2026-09-28" }, "2026-09-27")).toBe("rejected");
    render(<DeploymentStatusBadge deployment={deployment} today="2026-09-27" />);
    expect(screen.getByText("Upcoming")).toBeVisible();
  });

  it("uses the Philippine calendar date for today", () => {
    expect(manilaToday(new Date("2026-09-27T16:30:00Z"))).toBe("2026-09-28");
    expect(manilaToday(new Date("2026-09-27T15:59:00Z"))).toBe("2026-09-27");
  });
});
