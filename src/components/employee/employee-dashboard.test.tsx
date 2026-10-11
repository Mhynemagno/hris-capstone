import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  employee: null as unknown,
  deployments: [] as unknown[],
  logs: [] as unknown[],
  promotion: null as unknown,
  announcements: [] as unknown[],
}));
const ok = (data: unknown) => ({ isLoading: false, error: null, data });

vi.mock("@/hooks/use-personnel-records", () => ({ useEmployeeForCurrentUser: () => ok(state.employee) }));
vi.mock("@/hooks/use-administration", () => ({
  useRankOptions: () => ok([{ id: 1, code: "PAT", name: "Patrolman / Patrolwoman" }]),
  useDepartmentOptions: () => ok([{ id: 2, name: "Traffic and Investigation Section" }]),
}));
vi.mock("@/hooks/use-deployment-tracking", () => ({ useMyDeployments: () => ok({ rows: state.deployments, count: state.deployments.length }) }));
vi.mock("@/hooks/use-leave-management", () => ({
  useMyLeaveBalances: () => ok([{ leave_type_id: "t1", days_per_year: 15, excess_deducted_from_retirement: false, used_days: 3 }]),
  useLeaveTypes: () => ok({ rows: [{ id: "t1", name: "Sick Leave", days_per_year: 15 }], count: 1 }),
}));
vi.mock("@/hooks/use-attendance-integration", () => ({ useMyAttendanceLogs: () => ok({ rows: state.logs, count: state.logs.length }) }));
vi.mock("@/hooks/use-promotion-eligibility", () => ({ useMyPromotionEligibility: () => ok(state.promotion) }));
vi.mock("@/hooks/use-public-site", () => ({ usePublishedAnnouncements: () => ok(state.announcements) }));

import { EmployeeDashboard } from "./employee-dashboard";

const employee = { id: "e1", first_name: "Tyson", middle_name: "Bernal", last_name: "Peters", employee_number: "4-15889", rank_id: 1, department_id: 2, unit_station: "Sub-Station 1", profile_image_path: null, employment_status: "active", employment_started_on: "2024-01-05", employment_ended_on: null };

describe("EmployeeDashboard (empdash.html)", () => {
  beforeEach(() => {
    state.employee = employee;
    state.deployments = [];
    state.logs = [];
    state.promotion = null;
    state.announcements = [];
  });

  it("shows the live overview with its no-data states and links", async () => {
    const { container } = render(<EmployeeDashboard />);
    expect(await screen.findByRole("heading", { name: "Personnel Dashboard" })).toBeVisible();
    expect(screen.getByText("Tyson Bernal Peters")).toBeVisible();
    expect(screen.getByText("4-15889")).toBeVisible();
    expect(screen.getByRole("link", { name: "File Leave" })).toHaveAttribute("href", "/employee/leave?request=1");
    expect(screen.getByText("No current field assignment")).toBeVisible();
    expect(screen.getByText("Sick Leave")).toBeVisible();
    expect(screen.getByText("12d")).toBeVisible();
    expect(screen.getByText("Not yet recorded today")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Attendance" })).toHaveAttribute("href", "/employee/attendance");
    expect(screen.getByRole("link", { name: "View Promotion Status" })).toHaveAttribute("href", "/employee/promotion-eligibility");
    expect(screen.getByText("No announcements right now.")).toBeVisible();
    expect(screen.queryByText("Show Biometric Pass")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("profile-initials")).toHaveTextContent("TP");
  });

  it("explains a missing active criterion without a false eligible state", () => {
    render(<EmployeeDashboard />);
    expect(screen.getByText(/No active promotion criterion applies/)).toBeVisible();
    expect(screen.queryByText(/Eligible/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready/)).not.toBeInTheDocument();
  });

  it("shows the current assignment, today's attendance and the rank-matched promotion result", () => {
    state.deployments = [
      { id: "d0", status: "completed", location: "Old Post", starts_on: "2026-01-01", ends_on: "2026-01-02" },
      { id: "d1", status: "ongoing", location: "Greenhills Shopping Complex", project: "Mobile Patrol", unit: "Traffic and Investigation", deployment_type: "Regular Duty", starts_on: "2026-09-28", ends_on: null },
    ];
    state.logs = [{ id: "l1", time_in: "2026-10-10T21:19:00Z", time_out: null, status: "incomplete", capture_method: "face_recognition" }];
    state.promotion = { criterionId: "c1", currentRankName: "Patrolman", targetRankName: "Police Corporal", targetRankCode: "PCpl", evaluatedOn: null, docket: null, readiness: { yearsOfService: 2, minimumYearsOfService: 2, isReady: true, missingRequirements: [], requirements: [{ label: "Basic Course", met: true }] } };
    state.announcements = [{ id: "a1", title: "Kiosk Maintenance", summary: "Scheduled recalibration.", category: "advisory", published_at: "2026-10-10T00:00:00Z" }];
    render(<EmployeeDashboard />);
    expect(screen.getByText("Greenhills Shopping Complex")).toBeVisible();
    expect(screen.getByText("September 28, 2026 to present")).toBeVisible();
    expect(screen.queryByText("Old Post")).not.toBeInTheDocument();
    expect(screen.getByText("05:19")).toBeVisible();
    expect(screen.getByText(/Target rank: PCpl/)).toBeVisible();
    expect(screen.getByText("Eligible")).toBeVisible();
    expect(screen.getByText("Kiosk Maintenance")).toBeVisible();
  });
});
