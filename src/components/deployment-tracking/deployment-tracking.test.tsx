import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeploymentStatusBadge, effectiveDeploymentStatus, manilaToday } from "./deployment-status-badge";
import { EmployeeDeploymentList } from "./employee-deployment-list";
import { HrDeploymentDirectory } from "./hr-deployment-directory";

const row = { id: "d1", employee_id: "e1", location: "San Juan", unit: "Station 1", project: null, assignment_role: "San Juan", starts_on: "2026-09-23", ends_on: "2026-10-09", status: "active", notes: "Relief duty", updated_at: "2026-09-23T00:00:00Z" };
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useMyDeployments: () => ({ isLoading: false, error: null, data: { rows: [row], count: 1 } }),
  useHrDeployments: () => ({ isLoading: false, error: null, data: { rows: [row], count: 1 } }),
  useEmployeeOptions: () => ({ isLoading: false, error: null, data: [{ id: "e1", fullName: "Ana One", employeeNumber: "PAT-001" }] }),
}));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));

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

  it("shows the employee's deployments by location with dates in words and remarks", () => {
    render(<EmployeeDeploymentList />);
    expect(screen.getByText("San Juan")).toBeVisible();
    expect(screen.queryByText("Station 1")).not.toBeInTheDocument();
    expect(screen.getByText("September 23, 2026 – October 9, 2026")).toBeVisible();
    expect(screen.getByText(/Relief duty/)).toBeVisible();
  });

  it("lists deployments with a location column, no unit column, and dates in words", () => {
    render(<HrDeploymentDirectory />);
    expect(screen.getByRole("columnheader", { name: "Location" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Unit / Assignment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Role" })).not.toBeInTheDocument();
    expect(screen.getByText("September 23, 2026 – October 9, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-23/)).not.toBeInTheDocument();
  });
});
