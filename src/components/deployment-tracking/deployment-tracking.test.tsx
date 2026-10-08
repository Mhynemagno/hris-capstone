import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeploymentStatusBadge } from "./deployment-status-badge";
import { EmployeeDeploymentList } from "./employee-deployment-list";
import { HrDeploymentDirectory } from "./hr-deployment-directory";

const row = { id: "d1", employee_id: "e1", location: "San Juan", unit: "Station 1", project: null, assignment_role: "San Juan", starts_on: "2026-09-23", ends_on: "2026-10-09", status: "ongoing", deployment_type: "Public Assembly", event_operation: "Rally", notes: "Relief duty", updated_at: "2026-09-23T00:00:00Z" };
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useMyDeployments: () => ({ isLoading: false, error: null, data: { rows: [row], count: 1 } }),
  useHrDeployments: () => ({ isLoading: false, error: null, data: { rows: [row], count: 1 } }),
  useEmployeeOptions: () => ({ isLoading: false, error: null, data: [{ id: "e1", fullName: "Ana One", employeeNumber: "PAT-001" }] }),
}));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hr/deployments", useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams("") }));

describe("deployment tracking presentation", () => {
  it.each([["scheduled", "Scheduled"], ["ongoing", "Ongoing"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as const)("labels %s deployments accessibly", (status, label) => {
    render(<DeploymentStatusBadge deployment={{ status }} />);
    expect(screen.getByText(label)).toBeVisible();
  });

  it("shows the employee's deployments by location with dates in words and remarks", () => {
    render(<EmployeeDeploymentList />);
    expect(screen.getByText("San Juan")).toBeVisible();
    expect(screen.queryByText("Station 1")).not.toBeInTheDocument();
    expect(screen.getByText("September 23, 2026 – October 9, 2026")).toBeVisible();
    expect(screen.getByText(/Relief duty/)).toBeVisible();
    expect(screen.getByText("Public Assembly · Rally")).toBeVisible();
  });

  it("lists deployments with a location column, no unit column, and dates in words", () => {
    render(<HrDeploymentDirectory />);
    expect(screen.getByRole("columnheader", { name: "Location" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type / Event" })).toBeInTheDocument();
    expect(screen.getByText("Public Assembly")).toBeInTheDocument();
    expect(screen.getByText("Rally")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Unit / Assignment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Role" })).not.toBeInTheDocument();
    expect(screen.getByText("September 23, 2026 – October 9, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-23/)).not.toBeInTheDocument();
  });
});
