import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/hr",
  useSearchParams: () => new URLSearchParams(""),
}));

const summary = {
  generatedAt: "2026-10-08T00:00:00Z",
  range: { startsOn: "2026-09-09", endsOn: "2026-10-08" },
  metrics: { recruitmentApplications: 6, totalPersonnel: 160, attendanceToday: 142, activeWorkforce: 160, onLeave: 4, activeDeployments: 7, openJobs: 2, hiredApplicants: 1, pendingLeave: 2, attendanceExceptions: 5, trainingNeeds: 0 },
  breakdowns: {
    recruitmentPipeline: [{ label: "Application Submission", count: 3 }, { label: "Panel Interview", count: 1 }, { label: "Not Selected", count: 2 }],
    attendanceTrend: [{ label: "2026-10-07", count: 140 }],
    attendanceStatus: [{ label: "present", count: 130 }, { label: "late", count: 10 }],
    workforceByDepartment: [{ label: "Patrol", count: 90 }],
    workforceByRank: [{ label: "PAT", count: 50 }],
  },
};
vi.mock("@/hooks/use-reporting", () => ({
  useHrDashboard: () => ({ isLoading: false, error: null, data: summary, refetch: vi.fn() }),
  useManagementDashboard: () => ({ isLoading: false, error: null, data: summary, refetch: vi.fn() }),
}));
vi.mock("@/hooks/use-workspace-counts", () => ({ useWorkspaceCount: (key: string) => ({ data: key === "applicationsAwaitingReview" ? 3 : 0, isError: false }) }));
vi.mock("@/hooks/use-recruitment", () => ({
  useRecentApplications: () => ({ isLoading: false, error: null, data: [{ id: "a1", status: "Application Submission", submitted_at: "2026-10-07T00:00:00Z", applicant_name: "Aplica Candidate", job_title: "Patrol 2026" }] }),
}));
vi.mock("@/hooks/use-leave-management", () => ({ useHrLeaveRequests: () => ({ isLoading: false, error: null, data: { rows: [], count: 0 } }) }));
vi.mock("@/hooks/use-attendance-integration", () => ({ useHrAttendanceLogs: () => ({ isLoading: false, error: null, data: { rows: [], count: 0 } }) }));

import { WorkspaceDashboard } from "./workspace-dashboard";

describe("WorkspaceDashboard", () => {
  beforeEach(() => navigation.replace.mockReset());

  it("gives every HR stat a colored icon tile", () => {
    render(<WorkspaceDashboard role="hr_personnel" />);
    for (const name of ["Personnel", "On duty today", "On leave today", "Active deployments", "Open job postings"]) {
      expect(within(screen.getByRole("article", { name })).getByTestId("stat-icon")).toBeInTheDocument();
    }
  });

  it("offers HR quick actions with icons and live counts", () => {
    render(<WorkspaceDashboard role="hr_personnel" />);
    const actions = screen.getByRole("region", { name: "Quick actions" });
    expect(within(actions).getByRole("link", { name: /Manage employees.*160 personnel/ })).toHaveAttribute("href", "/hr/employees");
    expect(within(actions).getByRole("link", { name: /Recruitment.*6 applications/ })).toHaveAttribute("href", "/hr/applications");
    expect(within(actions).getByRole("link", { name: /Leave applications.*2 pending/ })).toHaveAttribute("href", "/hr/leave-requests");
    expect(within(actions).getByRole("link", { name: /Deployments.*7 active/ })).toHaveAttribute("href", "/hr/deployments");
    expect(within(actions).getByRole("link", { name: /Reports.*View analytics/ })).toHaveAttribute("href", "/reports");
  });

  it("keeps quick actions off the management dashboard", () => {
    render(<WorkspaceDashboard role="management" />);
    expect(screen.queryByRole("region", { name: "Quick actions" })).not.toBeInTheDocument();
  });

  it("keeps HR dashboard data visible by default and moves review queues to their own tab", async () => {
    const user = userEvent.setup();
    render(<WorkspaceDashboard role="hr_personnel" />);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dashboard data" })).toHaveAttribute("data-active");
    expect(screen.getByRole("tab", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs attention" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "On duty today" })).toHaveTextContent("142 / 160");
    expect(screen.getByRole("article", { name: "Open job postings" })).toHaveTextContent("2");
    const pipeline = screen.getByRole("region", { name: "Recruitment pipeline" });
    expect(within(pipeline).getByRole("link", { name: /Application Submission.*3/ })).toHaveAttribute("href", "/hr/applications?stage=Application%20Submission");
    expect(within(pipeline).getByText(/1 hired in this period/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Attendance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aplica Candidate" })).toHaveAttribute("href", "/hr/applications/a1");
    expect(screen.getByRole("button", { name: /Create/ })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Needs attention" }));

    expect(navigation.replace).toHaveBeenCalledWith("/hr?view=attention", { scroll: false });
  });

  it("shows a station pulse alongside the personnel distribution for HR", () => {
    render(<WorkspaceDashboard role="hr_personnel" />);
    const distribution = screen.getByRole("region", { name: "Personnel distribution" });
    expect(within(distribution).getByRole("img", { name: "Patrol: 90" })).toBeInTheDocument();
    const pulse = screen.getByRole("region", { name: "Today's station pulse" });
    expect(within(pulse).getByText("Present today")).toBeInTheDocument();
    expect(within(pulse).getByText("Deployed / outside field")).toBeInTheDocument();
  });

  it("gives Management a read-only view with workforce breakdowns", () => {
    render(<WorkspaceDashboard role="management" />);
    expect(screen.queryByRole("heading", { name: "Needs attention" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personnel by unit / section" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personnel by rank" })).toBeInTheDocument();
    expect(screen.queryByText("Recent applications")).not.toBeInTheDocument();
  });
});
