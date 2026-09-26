import type { AppRole } from "@/lib/types/roles";

export type RoleNavigationIcon =
  | "LayoutDashboard"
  | "Users"
  | "ShieldCheck"
  | "Building2"
  | "BriefcaseBusiness"
  | "Settings"
  | "ScrollText"
  | "ContactRound"
  | "FileText"
  | "CalendarDays"
  | "MapPin"
  | "TrendingUp"
  | "Clock"
  | "Fingerprint"
  | "ChartColumn"
  | "UserPen";

export type RoleNavigationItem = {
  href: `/${string}`;
  label: string;
  icon: RoleNavigationIcon;
  /** Sidebar section heading; related tasks share a group. */
  group?: string;
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
      { href: "/admin", label: "Admin workspace", icon: "LayoutDashboard", group: "Overview" },
      { href: "/admin/profile-change-requests", label: "Profile change requests", icon: "UserPen", group: "Reviews" },
      { href: "/admin/users", label: "Account management", icon: "Users", group: "Access" },
      { href: "/admin/audit-logs", label: "Audit logs", icon: "ScrollText", group: "Access" },
      { href: "/admin/departments", label: "Departments", icon: "Building2", group: "Organization" },
      { href: "/admin/ranks", label: "Ranks", icon: "BriefcaseBusiness", group: "Organization" },
      { href: "/admin/unit-stations", label: "Unit stations", icon: "MapPin", group: "Organization" },
      { href: "/admin/settings", label: "Settings", icon: "Settings", group: "System" },
      { href: "/admin/integrations/attendance", label: "Attendance integration", icon: "Fingerprint", group: "System" },
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
      { href: "/hr", label: "Dashboard", icon: "LayoutDashboard", group: "Overview" },
      { href: "/hr/jobs", label: "Job Opening", icon: "BriefcaseBusiness", group: "Recruitment" },
      { href: "/hr/applications", label: "Applications", icon: "FileText", group: "Recruitment" },
      { href: "/hr/employees", label: "Employee Records", icon: "ContactRound", group: "Personnel Management" },
      { href: "/hr/deployments", label: "Deployment Records", icon: "MapPin", group: "Personnel Management" },
      { href: "/hr/leave-requests", label: "Leave Management", icon: "CalendarDays", group: "Personnel Management" },
      { href: "/hr/promotions", label: "Promotion Records", icon: "TrendingUp", group: "Personnel Management" },
      { href: "/hr/attendance/kiosk", label: "Daily Attendance", icon: "Fingerprint", group: "Attendance Management" },
      { href: "/hr/attendance", label: "Attendance Records", icon: "Clock", group: "Attendance Management" },
      { href: "/reports/attendance-leave", label: "Attendance Report", icon: "ChartColumn", group: "Attendance Management" },
      { href: "/reports", label: "Reports", icon: "ChartColumn", group: "Insights" },
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
      { href: "/jobs", label: "Job openings", icon: "BriefcaseBusiness" },
      { href: "/applicant/profile", label: "My profile", icon: "ContactRound" },
      { href: "/applicant/applications", label: "My applications", icon: "FileText" },
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
      { href: "/employee/profile", label: "My profile", icon: "ContactRound" },
      { href: "/employee/leave", label: "Leave", icon: "CalendarDays" },
      { href: "/employee/deployments", label: "Deployments", icon: "MapPin" },
      { href: "/employee/promotion-eligibility", label: "Promotion eligibility", icon: "TrendingUp" },
      { href: "/employee/attendance", label: "Attendance", icon: "Clock" },
      { href: "/employee/attendance/scan", label: "Scan attendance", icon: "Fingerprint" },
    ],
  },
  management: {
    role: "management",
    label: "Management",
    homeHref: "/management",
    landingTitle: "Management workspace",
    landingDescription:
      "Review personnel information and organizational insights.",
    navigation: [
      {
        href: "/management",
        label: "Management workspace",
        icon: "LayoutDashboard",
      },
      { href: "/reports", label: "Reports", icon: "ChartColumn" },
    ],
  },
};

export function getRoleConfig(role: AppRole): RoleConfig {
  return ROLE_CONFIG[role];
}
