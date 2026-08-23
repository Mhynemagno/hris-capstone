import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReportingDashboard } from "./dashboard";

const dashboard = {
  generatedAt: "2026-08-24T00:00:00.000Z",
  range: { startsOn: "2026-08-01", endsOn: "2026-08-31" },
  metrics: { activeWorkforce: 3 },
  breakdowns: { recruitmentPipeline: [{ label: "Submitted", count: 2 }] },
};

vi.mock("@/hooks/use-reporting", () => ({
  useHrDashboard: () => ({ isLoading: false, error: null, data: dashboard }),
  useManagementDashboard: () => ({ isLoading: false, error: null, data: dashboard }),
}));

describe("reporting dashboard", () => {
  it("shows management analytics without mutation controls", () => {
    render(<ReportingDashboard role="management" />);
    expect(screen.getByRole("heading", { name: "Workforce analytics" })).toBeVisible();
    expect(screen.getByText("Active workforce")).toBeVisible();
    expect(screen.queryByRole("button", { name: /new|approve|import|edit/i })).not.toBeInTheDocument();
  });
});
