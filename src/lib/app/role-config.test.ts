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

  it("returns HR navigation scoped to HR personnel routes", () => {
    expect(getRoleConfig("hr_personnel")).toMatchObject({
      role: "hr_personnel",
      homeHref: "/hr",
      navigation: [
        { href: "/hr", label: "HR workspace", group: "Overview" },
        { href: "/hr/jobs", label: "Job openings", group: "Recruitment" },
        { href: "/hr/applications", label: "Applications", group: "Recruitment" },
        { href: "/hr/employees", label: "Personnel records", group: "Personnel" },
        { href: "/hr/deployments", label: "Deployments", group: "Personnel" },
        { href: "/hr/promotions", label: "Promotions", group: "Personnel" },
        { href: "/hr/leave-requests", label: "Leave requests", group: "Time and leave" },
        { href: "/hr/attendance", label: "Attendance", group: "Time and leave" },
        { href: "/reports", label: "Reports", group: "Insights" },
      ],
    });
  });

  it("exposes attendance only to its intended operational roles", () => {
    expect(getRoleConfig("hr_personnel").navigation).toContainEqual({ href: "/hr/attendance", label: "Attendance", icon: "Clock", group: "Time and leave" });
    expect(getRoleConfig("employee").navigation).toContainEqual({ href: "/employee/attendance", label: "Attendance", icon: "Clock" });
    expect(getRoleConfig("system_administrator").navigation).toContainEqual({ href: "/admin/integrations/attendance", label: "Attendance integration", icon: "Fingerprint", group: "System" });
    expect(getRoleConfig("management").navigation.some((item) => item.href.includes("attendance"))).toBe(false);
    expect(getRoleConfig("management").navigation).toContainEqual({ href: "/reports", label: "Reports", icon: "ChartColumn" });
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

  it("uses one account-management destination for administrator account and role work", () => {
    const navigation = getRoleConfig("system_administrator").navigation;

    expect(navigation).toContainEqual({ href: "/admin/users", label: "Account management", icon: "Users", group: "Access" });
    expect(navigation.some((item) => item.href === "/admin/roles")).toBe(false);
  });
});
