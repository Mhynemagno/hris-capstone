import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import AdminLayout from "./admin/layout";
import ApplicantLayout from "./applicant/layout";
import EmployeeLayout from "./employee/layout";
import HrLayout from "./hr/layout";
import ManagementLayout from "./management/layout";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));

vi.mock("@/lib/auth/require-role", () => ({ requireRole }));

type RoleLayout = ({ children }: { children: ReactNode }) => Promise<ReactNode>;

describe("role route layouts", () => {
  it.each([
    [AdminLayout, "system_administrator"],
    [HrLayout, "hr_personnel"],
    [EmployeeLayout, "employee"],
    [ApplicantLayout, "applicant"],
    [ManagementLayout, "management"],
  ] as const)("requires %s for its route", async (Layout, expectedRole) => {
    await (Layout as RoleLayout)({ children: <p>Protected content</p> });

    expect(requireRole).toHaveBeenCalledWith(expectedRole);
  });
});
