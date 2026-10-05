import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ReportingDashboard } from "./dashboard";

const useHrDashboard = vi.hoisted(() => vi.fn());
const useManagementDashboard = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-reporting", () => ({
  useHrDashboard,
  useManagementDashboard,
}));

it("shows only the five headline tiles, in order, under a plain Dashboard title", () => {
  useHrDashboard.mockReturnValue({
    data: {
      breakdowns: { employmentStatus: [{ count: 42, label: "Active" }] },
      generatedAt: "2026-08-24T00:00:00+00:00",
      metrics: { onLeave: 3, applicants: 9, activeDeployments: 7, departments: 5, totalPersonnel: 42, openJobs: 2, totalEmployees: 42 },
      range: { endsOn: "2026-08-24", startsOn: "2026-07-26" },
    },
    error: null,
    isLoading: false,
  });

  render(<ReportingDashboard role="hr_personnel" />);

  expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  expect(screen.queryByText(/Reporting period/)).not.toBeInTheDocument();
  const tiles = within(screen.getByRole("region", { name: "Key figures" })).getAllByRole("article");
  expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual(["Total Personnel", "Units / Sections", "Deployments", "Applicants", "On-Leave"]);
  const metric = screen.getByRole("article", { name: "Total Personnel" });
  expect(metric).toHaveTextContent("42");
  expect(within(metric).getByText("42")).toHaveClass("tabular-nums");
  expect(screen.getByRole("article", { name: "Deployments" })).toHaveTextContent("7");
  expect(screen.queryByRole("article", { name: "Open job postings" })).not.toBeInTheDocument();
  expect(screen.queryByRole("article", { name: "Total employees" })).not.toBeInTheDocument();
});

it("charts every breakdown with accessible summaries and links to the detailed reports", () => {
  useManagementDashboard.mockReturnValue({
    data: {
      breakdowns: {
        attendanceStatus: [{ count: 18, label: "present" }, { count: 2, label: "late" }],
        attendanceTrend: [{ count: 0, label: "2026-08-23" }, { count: 5, label: "2026-08-24" }],
        leaveByType: [{ count: 2, label: "Vacation" }],
        promotionReadiness: [{ count: 1, label: "Ready" }],
        recruitmentPipeline: [{ count: 1, label: "Hired" }, { count: 4, label: "Submitted" }],
        workforceByRank: [],
      },
      generatedAt: "2026-08-24T00:00:00+00:00",
      metrics: { onLeave: 4, pendingLeave: 3, openJobs: 2 },
      range: { endsOn: "2026-08-24", startsOn: "2026-07-26" },
    },
    error: null,
    isLoading: false,
  });

  render(<ReportingDashboard role="management" />);

  expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  expect(screen.getByRole("article", { name: "On-Leave" })).toHaveTextContent("4");
  expect(screen.queryByRole("article", { name: "Open job postings" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Leave by type" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Promotion Status" })).toBeInTheDocument();

  const attendance = screen.getByRole("region", { name: "Attendance status" });
  expect(within(attendance).getByRole("img", { name: "Present: 18, Late: 2" })).toBeInTheDocument();
  expect(within(attendance).getByText("90%")).toBeInTheDocument();

  const pipeline = screen.getByRole("region", { name: "Recruitment pipeline" });
  // Stages read in pipeline order, not alphabetically.
  expect(within(pipeline).getByRole("img", { name: "Submitted: 4, Hired: 1" })).toBeInTheDocument();

  expect(screen.getByRole("region", { name: "Daily attendance" })).toHaveTextContent("Aug 24");
  expect(screen.getByRole("region", { name: "Personnel by rank" })).toHaveTextContent("No records in this reporting period.");

  expect(screen.getByRole("link", { name: /Attendance and leave/ })).toHaveAttribute("href", "/reports/attendance-leave");
});

it("gives HR shortcuts, open work notifications, and an attendance gauge", () => {
  useHrDashboard.mockReturnValue({
    data: {
      breakdowns: {},
      generatedAt: "2026-08-24T00:00:00+00:00",
      metrics: { activeWorkforce: 50, attendanceToday: 47, pendingLeave: 3, attendanceExceptions: 0 },
      range: { endsOn: "2026-08-24", startsOn: "2026-07-26" },
    },
    error: null,
    isLoading: false,
  });

  render(<ReportingDashboard role="hr_personnel" />);

  expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/reports");
  expect(screen.getByRole("link", { name: "New Employee" })).toHaveAttribute("href", "/hr/employees/new");
  const attention = screen.getByRole("region", { name: "Notification" });
  expect(within(attention).getByText("1 of 2 clear")).toBeInTheDocument();
  expect(within(attention).getByRole("link", { name: /^3 leave requests for approval\s*\(open\)$/ })).toHaveAttribute("href", "/hr/leave-requests");
  expect(within(attention).getByRole("link", { name: /^0 attendance exceptions to review\s*\(clear\)$/ })).toHaveAttribute("href", "/hr/attendance");
  expect(screen.getByRole("img", { name: "Present: 94% (47 of 50)" })).toBeInTheDocument();
});
