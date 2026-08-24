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
