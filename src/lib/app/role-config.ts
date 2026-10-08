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

/** Live counts shown beside a nav item (src/hooks/use-workspace-counts.ts). */
export type NavBadgeKey = "applicationsAwaitingReview" | "leaveForApproval" | "profileChangesPending";

export type RoleNavigationItem = {
  href: `/${string}`;
  label: string;
  icon: RoleNavigationIcon;
  /** Sidebar section heading; related tasks share a group. */
  group?: string;
  badge?: NavBadgeKey;
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
    landingTitle: "Dashboard",
    landingDescription:
      "Manage secure system settings, accounts, and organization data.",
    navigation: [
      { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/admin/users", label: "Accounts", icon: "Users", group: "People" },
      { href: "/admin/profile-change-requests", label: "Approvals", icon: "UserPen", group: "People", badge: "profileChangesPending" },
      { href: "/admin/departments", label: "Units / Sections", icon: "Building2", group: "Organization" },
      { href: "/admin/unit-stations", label: "Units / Stations", icon: "MapPin", group: "Organization" },
      { href: "/admin/ranks", label: "Ranks", icon: "BriefcaseBusiness", group: "Organization" },
      { href: "/admin/settings", label: "Settings", icon: "Settings", group: "System" },
      { href: "/admin/integrations/attendance", label: "Attendance integration", icon: "Fingerprint", group: "System" },
      { href: "/admin/audit-logs", label: "Audit log", icon: "ScrollText", group: "System" },
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
      { href: "/hr", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/hr/jobs", label: "Job postings", icon: "BriefcaseBusiness", group: "Recruitment" },
      { href: "/hr/applications", label: "Applications", icon: "FileText", group: "Recruitment", badge: "applicationsAwaitingReview" },
      { href: "/hr/employees", label: "Employees", icon: "ContactRound", group: "Personnel" },
      { href: "/hr/deployments", label: "Deployments", icon: "MapPin", group: "Personnel" },
      { href: "/hr/leave-requests", label: "Leave", icon: "CalendarDays", group: "Personnel", badge: "leaveForApproval" },
      { href: "/hr/promotions", label: "Promotions", icon: "TrendingUp", group: "Personnel" },
      { href: "/hr/attendance", label: "Attendance", icon: "Clock", group: "Attendance" },
      { href: "/hr/attendance/kiosk", label: "Kiosk", icon: "Fingerprint", group: "Attendance" },
      { href: "/reports", label: "Reports", icon: "ChartColumn", group: "Insights" },
      { href: "/hr/public-site", label: "Announcements", icon: "ScrollText", group: "Public site" },
    ],
  },
  applicant: {
    role: "applicant",
    label: "Applicant",
    homeHref: "/applicant",
    landingTitle: "Dashboard",
    landingDescription:
      "Explore opportunities and follow the progress of your applications.",
    navigation: [
      { href: "/applicant", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/applicant/profile", label: "Profile", icon: "ContactRound" },
      { href: "/jobs", label: "Recruitment", icon: "BriefcaseBusiness" },
      { href: "/applicant/documents", label: "Documents", icon: "FileText" },
      { href: "/applicant/applications", label: "Application Status", icon: "Clock" },
    ],
  },
  employee: {
    role: "employee",
    label: "Employee",
    homeHref: "/employee",
    landingTitle: "Dashboard",
    landingDescription:
      "Access your HR information, requests, and work-related updates.",
    navigation: [
      { href: "/employee", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/employee/profile", label: "My profile", icon: "ContactRound" },
      { href: "/employee/leave", label: "Leave", icon: "CalendarDays" },
      { href: "/employee/deployments", label: "Deployments", icon: "MapPin" },
      { href: "/employee/promotion-eligibility", label: "Promotion", icon: "TrendingUp" },
      { href: "/employee/attendance", label: "Attendance", icon: "Clock" },
      { href: "/employee/attendance/scan", label: "Scan", icon: "Fingerprint" },
    ],
  },
  management: {
    role: "management",
    label: "Management",
    homeHref: "/management",
    landingTitle: "Dashboard",
    landingDescription:
      "Review personnel information and organizational insights.",
    navigation: [
      { href: "/management", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/reports", label: "Reports", icon: "ChartColumn" },
    ],
  },
};

export function getRoleConfig(role: AppRole): RoleConfig {
  return ROLE_CONFIG[role];
}
