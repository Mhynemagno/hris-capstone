import type { AppRole } from "@/lib/types/roles";

const roleHomes: Record<AppRole, `/${string}`> = {
  system_administrator: "/admin",
  hr_personnel: "/hr",
  applicant: "/applicant",
  employee: "/employee",
  management: "/management",
};

export function getRoleHome(role: AppRole): `/${string}` {
  return roleHomes[role];
}
