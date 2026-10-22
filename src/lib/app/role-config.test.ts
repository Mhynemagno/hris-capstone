import { describe, expect, it } from "vitest";

import { APP_ROLES } from "@/lib/types/roles";

import { ROLE_CONFIG, getRoleConfig } from "./role-config";

describe("role configuration", () => {
  it("defines one landing page for every application role", () => {
    expect(Object.keys(ROLE_CONFIG).sort()).toEqual([...APP_ROLES].sort());
    expect(new Set(Object.values(ROLE_CONFIG).map(({ homeHref }) => homeHref)).size).toBe(
      APP_ROLES.length,
    );
  });

  it("keeps grouped navigation items adjacent so each sidebar heading appears once", () => {
    for (const config of Object.values(ROLE_CONFIG)) {
      const seen: string[] = [];
      for (const item of config.navigation) {
        const group = item.group ?? "";
        if (seen.at(-1) !== group) {
          expect(seen).not.toContain(group);
          seen.push(group);
        }
      }
    }
  });

  it("uses the requested applicant sidebar order", () => {
    expect(getRoleConfig("applicant").navigation.map(({ href, label, icon }) => ({ href, label, icon }))).toEqual([
      { href: "/applicant", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/applicant/profile", label: "Profile", icon: "ContactRound" },
      { href: "/applicant/documents", label: "Documents", icon: "FileText" },
      { href: "/applicant/applications", label: "Application Status", icon: "Clock" },
    ]);
  });

  it("returns the Capstone UI HR navigation (dashboard.html) without the Kiosk", () => {
    expect(getRoleConfig("hr_personnel").navigation.map(({ href, label, group, badge }) => ({ href, label, group, badge }))).toEqual([
      { href: "/hr", label: "Dashboard", group: undefined, badge: undefined },
      { href: "/hr/jobs", label: "Recruitment Openings", group: "Recruitment", badge: undefined },
      { href: "/hr/applications", label: "Applicant Roster", group: "Recruitment", badge: "applicationsAwaitingReview" },
      { href: "/hr/employees", label: "List of Personnels", group: "Personnel", badge: undefined },
      { href: "/hr/deployments", label: "Deployments", group: "Personnel", badge: undefined },
      { href: "/hr/leave-requests", label: "Leave", group: "Personnel", badge: "leaveForApproval" },
      { href: "/hr/promotions", label: "Promotion", group: "Personnel", badge: undefined },
      { href: "/hr/profile-requests", label: "Profile Change Requests", group: "Personnel", badge: "profileChangesPending" },
      { href: "/hr/attendance", label: "Daily Attendance Logs", group: "Attendance & DTR", badge: undefined },
      { href: "/reports", label: "HR Audit & Reports", group: "Reports", badge: undefined },
      { href: "/hr/public-site", label: "Announcements", group: "Public Site", badge: undefined },
    ]);
  });

  it("groups administrator navigation into the Capstone system-administration modules", () => {
    expect(getRoleConfig("system_administrator").navigation.map(({ href, label, group }) => ({ href, label, group }))).toEqual([
      { href: "/admin", label: "Dashboard", group: undefined },
      { href: "/admin/users", label: "Manage Accounts", group: "People and Access" },
      { href: "/admin/profile-change-requests", label: "Review Approvals", group: "People and Access" },
      { href: "/admin/departments", label: "Units and Sections", group: "Station Organization" },
      { href: "/admin/unit-stations", label: "Units and Stations", group: "Station Organization" },
      { href: "/admin/ranks", label: "Ranks", group: "Station Organization" },
      { href: "/admin/integrations/attendance", label: "Attendance Integration", group: "System Oversight" },
      { href: "/admin/audit-logs", label: "Audit Log", group: "System Oversight" },
      { href: "/admin/settings", label: "System Settings", group: "System Oversight" },
    ]);
    expect(getRoleConfig("system_administrator").navigation.some((item) => item.href === "/admin/roles")).toBe(false);
    expect(getRoleConfig("system_administrator").navigation.some((item) => item.href.startsWith("/hr"))).toBe(false);
  });

  it("uses the Capstone employee navigation without a standalone scan page", () => {
    expect(getRoleConfig("employee").navigation.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/employee", label: "Dashboard" },
      { href: "/employee/profile", label: "My Profile" },
      { href: "/employee/leave", label: "Leave" },
      { href: "/employee/deployments", label: "Deployment" },
      { href: "/employee/promotion-eligibility", label: "Promotion Status" },
      { href: "/employee/attendance", label: "Attendance" },
    ]);
  });

  it("keeps the management menu unchanged", () => {
    expect(getRoleConfig("management").navigation.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/management", label: "Dashboard" },
      { href: "/reports", label: "Reports" },
    ]);
    expect(getRoleConfig("management").landingTitle).toBe("Dashboard");
  });
});
