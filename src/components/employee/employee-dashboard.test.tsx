import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  employee: null as unknown,
  deployments: [] as unknown[],
  logs: [] as unknown[],
  promotion: null as unknown,
  announcements: [] as unknown[],
  photo: undefined as string | undefined,
  loading: false,
  typesError: null as Error | null,
  ranksError: null as Error | null,
  requestRecordAssistance: vi.fn(),
}));
const ok = (data: unknown) => ({ isLoading: state.loading, error: null, data: state.loading ? undefined : data });

vi.mock("@/hooks/use-personnel-records", () => ({
  useEmployeeForCurrentUser: () => ({ isLoading: false, error: null, data: state.employee }),
  useEmployeeProfilePhotoUrl: () => ({ data: state.photo }),
  useRequestEmployeeRecordAssistance: () => ({ isPending: false, mutateAsync: state.requestRecordAssistance }),
}));
vi.mock("@/hooks/use-administration", () => ({
  useRankOptions: () => state.ranksError ? { isLoading: false, error: state.ranksError, data: undefined } : ok([{ id: 1, code: "PAT", name: "Patrolman / Patrolwoman" }]),
  useDepartmentOptions: () => ok([{ id: 2, name: "Traffic and Investigation Section" }]),
}));
vi.mock("@/hooks/use-deployment-tracking", () => ({ useMyDeployments: () => ok({ rows: state.deployments, count: state.deployments.length }) }));
vi.mock("@/hooks/use-leave-management", () => ({
  useMyLeaveBalances: () => ok([{ leave_type_id: "t1", days_per_year: 15, excess_deducted_from_retirement: false, used_days: 3 }]),
  useLeaveTypes: () => state.typesError ? { isLoading: false, error: state.typesError, data: undefined } : ok({ rows: [{ id: "t1", name: "Sick Leave", days_per_year: 15 }], count: 1 }),
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
    state.photo = undefined;
    state.loading = false;
    state.typesError = null;
    state.ranksError = null;
    state.requestRecordAssistance.mockReset();
    state.requestRecordAssistance.mockResolvedValue(undefined);
  });

  it("shows loading states instead of false empty states while queries load", () => {
    state.loading = true;
    render(<EmployeeDashboard />);
    expect(screen.queryByText("No current field assignment")).not.toBeInTheDocument();
    expect(screen.queryByText("Not yet recorded today")).not.toBeInTheDocument();
    expect(screen.queryByText(/No active promotion criterion/)).not.toBeInTheDocument();
    expect(screen.queryByText("No active criterion")).not.toBeInTheDocument();
    expect(screen.queryByText(/No leave entitlements/)).not.toBeInTheDocument();
    expect(screen.queryByText("No announcements right now.")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Loading/).length).toBeGreaterThanOrEqual(5);
  });

  it("lets an unlinked employee notify HR to link the official record", async () => {
    state.employee = null;
    const user = userEvent.setup();
    render(<EmployeeDashboard />);
    await user.click(screen.getByRole("button", { name: "Contact HR" }));
    expect(state.requestRecordAssistance).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("HR has been notified to help link your record.")).toBeVisible();
  });

  it("shows an error instead of an empty list when leave types fail, and flags rank failures", () => {
    state.typesError = new Error("leave types down");
    state.ranksError = new Error("ranks down");
    render(<EmployeeDashboard />);
    expect(screen.getByText("leave types down")).toBeVisible();
    expect(screen.queryByText(/No leave entitlements/)).not.toBeInTheDocument();
    expect(screen.queryByText("Rank not provided")).not.toBeInTheDocument();
    expect(screen.getByText("Rank unavailable")).toBeVisible();
  });

  it("renders the real profile photo when the record has one, else initials", () => {
    state.employee = { ...employee, profile_image_path: "e1/photo.jpg" };
    state.photo = "https://signed.example/photo.jpg";
    const { container } = render(<EmployeeDashboard />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://signed.example/photo.jpg");
  });

  it("marks the banner tile as submitted when a docket exists", () => {
    state.promotion = { criterionId: "c1", currentRankName: "Patrolman", targetRankName: "Police Corporal", targetRankCode: "PCpl", evaluatedOn: null, docket: { id: "k", criterionId: "c1", remarks: "x", submittedAt: "2026-10-01T00:00:00Z" }, readiness: { yearsOfService: 2, minimumYearsOfService: 2, isReady: false, missingRequirements: [], requirements: [] } };
    render(<EmployeeDashboard />);
    expect(screen.getByText("PCpl Submitted")).toBeVisible();
    expect(screen.queryByText("PCpl In progress")).not.toBeInTheDocument();
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
