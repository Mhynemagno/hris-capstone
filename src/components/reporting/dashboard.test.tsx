import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ReportingDashboard } from "./dashboard";

const useHrDashboard = vi.hoisted(() => vi.fn());
const useManagementDashboard = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-reporting", () => ({
  useHrDashboard,
  useManagementDashboard,
}));

it("presents HR metrics through scannable civic dashboard cards", () => {
  useHrDashboard.mockReturnValue({
    data: {
      breakdowns: { employmentStatus: [{ count: 42, label: "Active" }] },
      generatedAt: "2026-08-24T00:00:00+00:00",
      metrics: { totalEmployees: 42 },
      range: { endsOn: "2026-08-24", startsOn: "2026-07-26" },
    },
    error: null,
    isLoading: false,
  });

  render(<ReportingDashboard role="hr_personnel" />);

  expect(
    screen.getByRole("heading", { level: 1, name: "HR operations dashboard" }),
  ).toBeVisible();
  const metric = screen.getByRole("article", { name: "Total employees" });
  expect(metric).toHaveTextContent("42");
  expect(within(metric).getByText("42")).toHaveClass("tabular-nums");
});

it("charts every breakdown with accessible summaries and links to the detailed reports", () => {
  useManagementDashboard.mockReturnValue({
    data: {
      breakdowns: {
        attendanceStatus: [{ count: 18, label: "present" }, { count: 2, label: "late" }],
        attendanceTrend: [{ count: 0, label: "2026-08-23" }, { count: 5, label: "2026-08-24" }],
        recruitmentPipeline: [{ count: 1, label: "Hired" }, { count: 4, label: "Submitted" }],
        workforceByRank: [],
      },
      generatedAt: "2026-08-24T00:00:00+00:00",
      metrics: { activeWorkforce: 30, pendingLeave: 3, openJobs: 2 },
      range: { endsOn: "2026-08-24", startsOn: "2026-07-26" },
    },
    error: null,
    isLoading: false,
  });

  render(<ReportingDashboard role="management" />);

  expect(screen.getByRole("article", { name: "Active personnel" })).toHaveTextContent("30");
  expect(screen.getByRole("article", { name: "Open job postings" })).toHaveTextContent("2");

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
