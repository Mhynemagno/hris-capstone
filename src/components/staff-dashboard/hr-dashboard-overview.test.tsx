import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ readiness: [] as unknown[] }));

vi.mock("@/hooks/use-reporting", () => ({
  useHrDashboard: () => ({
    isLoading: false,
    error: null,
    data: {
      generatedAt: "2026-10-11T00:00:00+08:00",
      range: { startsOn: "2026-09-12", endsOn: "2026-10-11" },
      metrics: { openJobs: 1 },
      breakdowns: {
        workforceByDepartment: [{ label: "ARMS", count: 7 }, { label: "IDMS", count: 4 }],
        recruitmentPipeline: [{ label: "Application Submission", count: 0 }, { label: "Physical Agility Test", count: 1 }, { label: "Not Selected", count: 1 }],
      },
    },
  }),
  useHrDashboardOverview: () => ({
    isLoading: false,
    error: null,
    data: {
      personnelByRank: [{ code: "PMAJ", name: "Police Major", count: 1 }, { code: null, name: null, count: 4 }],
      personnelByGender: [{ label: "male", count: 20 }, { label: "female", count: 8 }, { label: "unspecified", count: 0 }],
      attendanceToday: { present: 25, late: 1, incomplete: 1, absent: 0, onLeave: 1 },
    },
  }),
}));
vi.mock("@/hooks/use-promotion-eligibility", () => ({ usePromotionReadiness: () => ({ isLoading: false, error: null, data: state.readiness }) }));
vi.mock("@/hooks/use-recruitment", () => ({
  useRecentApplications: () => ({ isLoading: false, error: null, data: [{ id: "a1", status: "Physical Agility Test", submitted_at: "2026-10-11T01:15:00Z", applicant_name: "Juan Dela Cruz", job_title: "Patrolman Recruitment" }] }),
}));
vi.mock("@/hooks/use-deployment-tracking", () => ({
  useHrDeployments: () => ({ isLoading: false, error: null, data: { rows: [{ id: "d1", employee_id: "e1", location: "Greenhills Sector", deployment_type: "Public Assembly", status: "ongoing", starts_on: "2026-10-11", ends_on: null }], count: 1 } }),
  useEmployeeOptions: () => ({ data: [{ id: "e1", fullName: "Ramon Reyes", employeeNumber: "1-00001" }] }),
}));

import { HrDashboardOverview } from "./hr-dashboard-overview";

const ready = { employee_id: "e1", employee_name: "Tyson Peters", readiness: { isReady: true } };
const notReady = { employee_id: "e2", employee_name: "Ana Cruz", readiness: { isReady: false } };

describe("HrDashboardOverview (dashboard.html)", () => {
  beforeEach(() => { state.readiness = [ready, notReady]; });

  it("shows live KPIs in the mockup tiles", () => {
    render(<HrDashboardOverview />);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard Overview" })).toBeInTheDocument();
    const kpi = (label: string) => screen.getByText(label, { selector: "article p" }).closest("article")!;
    expect(kpi("Total Active 201")).toHaveTextContent("28");
    expect(kpi("On Duty")).toHaveTextContent("26/ 28");
    expect(kpi("On Duty")).toHaveTextContent("92.9% Operational Strength");
    expect(kpi("On Duty")).toHaveTextContent("25 present · 1 late");
    expect(kpi("Absent")).toHaveTextContent("0");
    expect(kpi("On Leave")).toHaveTextContent("1");
    expect(kpi("Incomplete")).toHaveTextContent("1");
    expect(kpi("Plantilla Vacancies")).toHaveTextContent("1");
  });

  it("switches the personnel distribution between units, ranks and gender", async () => {
    render(<HrDashboardOverview />);
    expect(screen.getByText("Personnel Distribution by Unit")).toBeInTheDocument();
    expect(screen.getByText("7 Personnel (63.6%)")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filter personnel distribution"), "ranks");
    expect(screen.getByText("Personnel Distribution by Rank Hierarchy")).toBeInTheDocument();
    expect(screen.getByText("Police Major (PMAJ)")).toBeInTheDocument();
    expect(screen.getByText("Non-Uniformed Personnel (NUP)")).toBeInTheDocument();
    expect(screen.getByText("Total: 5 Personnel")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filter personnel distribution"), "gender");
    expect(screen.getByText("Male Personnel")).toBeInTheDocument();
    expect(screen.getByText("Female Personnel")).toBeInTheDocument();
    expect(screen.queryByText("Not specified")).not.toBeInTheDocument();
    expect(screen.getByText("Total: 28 Personnel")).toBeInTheDocument();
  });

  it("shows the pipeline, attendance, promotion notice and recent activity", () => {
    render(<HrDashboardOverview />);
    expect(screen.getByText("2 Total Applicants")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to full attendance roster/i })).toHaveAttribute("href", "/hr/attendance");
    expect(screen.getByRole("heading", { name: "Qualified for Promotion" })).toBeInTheDocument();
    expect(screen.getByText("1 personnel are qualified for promotion review this quarter.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review endorsements/i })).toHaveAttribute("href", "/hr/promotions");
    expect(screen.getByRole("heading", { name: "Recruitment Openings" })).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all applications/i })).toHaveAttribute("href", "/hr/applications");
    expect(screen.getByRole("heading", { name: "Recent Deployments" })).toBeInTheDocument();
    expect(screen.getByText("Ramon Reyes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view full roster/i })).toHaveAttribute("href", "/hr/deployments");
  });

  it("hides the Promotion Notice when nobody is ready", () => {
    state.readiness = [notReady];
    render(<HrDashboardOverview />);
    expect(screen.queryByText(/Promotion Endorsement/)).not.toBeInTheDocument();
  });
});
