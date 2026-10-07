import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceDashboard } from "./workspace-dashboard";

const dashboard = {
  generatedAt: "2026-08-24T00:00:00.000Z",
  range: { startsOn: "2026-08-01", endsOn: "2026-08-31" },
  metrics: { totalPersonnel: 3 },
  breakdowns: { recruitmentPipeline: [{ label: "Submitted", count: 2 }] },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/management",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/hooks/use-reporting", () => ({
  useHrDashboard: () => ({ isLoading: false, error: null, data: dashboard }),
  useManagementDashboard: () => ({ isLoading: false, error: null, data: dashboard }),
}));
vi.mock("@/hooks/use-workspace-counts", () => ({ useWorkspaceCount: () => ({ data: undefined, isError: false }) }));
vi.mock("@/hooks/use-recruitment", () => ({ useRecentApplications: () => ({ isLoading: false, error: null, data: [] }) }));

describe("reporting dashboard", () => {
  it("shows management analytics without mutation controls, even when metrics are sparse", () => {
    render(<WorkspaceDashboard role="management" />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(screen.getByRole("article", { name: "Personnel" })).toHaveTextContent("3");
    expect(screen.queryByRole("button", { name: /new|approve|import|edit|create/i })).not.toBeInTheDocument();
  });
});
