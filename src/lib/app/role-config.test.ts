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
      ],
    });
  });
});
