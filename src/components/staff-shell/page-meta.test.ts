import { describe, expect, it } from "vitest";
import { isRedesignedStaffRoute, staffPageSubtitle } from "./page-meta";

describe("staff page meta", () => {
  it("gives each section its mockup subtitle", () => {
    expect(staffPageSubtitle("/hr/jobs")).toBe("Recruitment Module • Plantilla & Job Openings");
    expect(staffPageSubtitle("/hr/jobs/12")).toBe("Recruitment Module • Plantilla & Job Openings");
    expect(staffPageSubtitle("/hr/leave-requests")).toBe("Leave Management & Personnel Entitlements");
    expect(staffPageSubtitle("/reports/deployments")).toBe("Personnel Management • Official Analytics & Station Reports");
    expect(staffPageSubtitle("/hr")).toBe("Dashboard • Manpower, Attendance & Deployment Overview");
    expect(staffPageSubtitle("/employee/attendance")).toBe("Personnel Self-Service • Attendance");
    expect(staffPageSubtitle("/admin/settings")).toBe("System Administration & Station Controls");
  });
  it("knows which pages are redesigned (the rest keep the workspace look)", () => {
    expect(isRedesignedStaffRoute("/hr/deployments")).toBe(true);
    expect(isRedesignedStaffRoute("/hr/deployments/abc")).toBe(false);
    expect(isRedesignedStaffRoute("/hr/employees")).toBe(false);
    expect(isRedesignedStaffRoute("/reports")).toBe(true);
    expect(isRedesignedStaffRoute("/reports/deployments")).toBe(false);
    expect(isRedesignedStaffRoute("/employee/promotion-eligibility")).toBe(true);
    expect(isRedesignedStaffRoute("/admin/audit-logs")).toBe(true);
  });
});
