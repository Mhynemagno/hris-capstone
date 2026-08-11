import type { AppRole } from "@/lib/types/roles";

export type RoleNavigationItem = {
  href: `/${string}`;
  label: string;
  icon: "LayoutDashboard" | "Users" | "ShieldCheck" | "Building2" | "BriefcaseBusiness" | "Settings" | "ScrollText" | "ContactRound";
};

export type RoleConfig = {
  role: AppRole;
  label: string;
  homeHref: `/${string}`;
  landingTitle: string;
  landingDescription: string;
  navigation: readonly RoleNavigationItem[];
};

export const ROLE_CONFIG: Record<AppRole, RoleConfig> = {
  system_administrator: {
    role: "system_administrator",
    label: "System Administrator",
    homeHref: "/admin",
    landingTitle: "Administration workspace",
    landingDescription:
      "Manage secure system settings, accounts, and organization data.",
    navigation: [
      { href: "/admin", label: "Admin workspace", icon: "LayoutDashboard" },
      { href: "/admin/users", label: "Users", icon: "Users" },
      { href: "/admin/roles", label: "Roles", icon: "ShieldCheck" },
      { href: "/admin/departments", label: "Departments", icon: "Building2" },
      { href: "/admin/positions", label: "Positions", icon: "BriefcaseBusiness" },
      { href: "/admin/settings", label: "Settings", icon: "Settings" },
      { href: "/admin/audit-logs", label: "Audit logs", icon: "ScrollText" },
    ],
  },
  hr_personnel: {
    role: "hr_personnel",
    label: "HR Personnel",
    homeHref: "/hr",
    landingTitle: "HR workspace",
    landingDescription:
      "Coordinate recruitment, personnel records, and HR operations.",
    navigation: [
      { href: "/hr", label: "HR workspace", icon: "LayoutDashboard" },
      { href: "/hr/employees", label: "Personnel records", icon: "ContactRound" },
    ],
  },
  applicant: {
    role: "applicant",
    label: "Applicant",
    homeHref: "/applicant",
    landingTitle: "Applicant portal",
    landingDescription:
      "Explore opportunities and follow the progress of your applications.",
    navigation: [
      {
        href: "/applicant",
        label: "Applicant portal",
        icon: "LayoutDashboard",
      },
    ],
  },
  employee: {
    role: "employee",
    label: "Employee",
    homeHref: "/employee",
    landingTitle: "Employee workspace",
    landingDescription:
      "Access your HR information, requests, and work-related updates.",
    navigation: [
      {
        href: "/employee",
        label: "Employee workspace",
        icon: "LayoutDashboard",
      },
    ],
  },
  management: {
    role: "management",
    label: "Management",
    homeHref: "/management",
    landingTitle: "Management workspace",
    landingDescription:
      "Review workforce information and organizational insights.",
    navigation: [
      {
        href: "/management",
        label: "Management workspace",
        icon: "LayoutDashboard",
      },
    ],
  },
};

export function getRoleConfig(role: AppRole): RoleConfig {
  return ROLE_CONFIG[role];
}
