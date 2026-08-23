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
        { href: "/hr", label: "HR workspace" },
        { href: "/hr/employees", label: "Personnel records" },
        { href: "/hr/jobs", label: "Job openings" },
        { href: "/hr/applications", label: "Applications" },
        { href: "/hr/leave-requests", label: "Leave requests" },
        { href: "/hr/deployments", label: "Deployments" },
        { href: "/hr/promotions", label: "Promotions" },
        { href: "/hr/attendance", label: "Attendance" },
        { href: "/reports", label: "Reports" },
      ],
    });
  });

  it("exposes attendance only to its intended operational roles", () => {
    expect(getRoleConfig("hr_personnel").navigation).toContainEqual({ href: "/hr/attendance", label: "Attendance", icon: "BriefcaseBusiness" });
    expect(getRoleConfig("employee").navigation).toContainEqual({ href: "/employee/attendance", label: "Attendance", icon: "BriefcaseBusiness" });
    expect(getRoleConfig("system_administrator").navigation).toContainEqual({ href: "/admin/integrations/attendance", label: "Attendance integration", icon: "Settings" });
    expect(getRoleConfig("management").navigation.some((item) => item.href.includes("attendance"))).toBe(false);
    expect(getRoleConfig("management").navigation).toContainEqual({ href: "/reports", label: "Reports", icon: "ScrollText" });
  });
});
