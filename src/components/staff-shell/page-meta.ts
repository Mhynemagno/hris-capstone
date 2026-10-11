const SUBTITLES: [root: string, subtitle: string][] = [
  ["/hr/jobs", "Recruitment Module • Plantilla & Job Openings"],
  ["/hr/applications", "Recruitment Module • Applicant Tracking & Roster"],
  ["/hr/employees", "Personnel Management • Personnel 201 Records"],
  ["/hr/deployments", "Personnel Management • Duty Deployments & Field Assignments"],
  ["/hr/leave-requests", "Leave Management & Personnel Entitlements"],
  ["/hr/promotions", "Personnel Management • Promotion Board & Criteria"],
  ["/hr/attendance", "Personnel Management • Face Biometrics & Attendance Logs"],
  ["/reports", "Personnel Management • Official Analytics & Station Reports"],
  ["/hr/public-site", "Public Site • Announcements & Station Contacts"],
  ["/admin", "System Administration & Station Controls"],
  ["/notifications", "Notifications"],
  ["/employee/profile", "Personnel Self-Service • My Profile 201"],
  ["/employee/leave", "Personnel Self-Service • My Leaves"],
  ["/employee/deployments", "Personnel Self-Service • My Deployments"],
  ["/employee/promotion-eligibility", "Personnel Self-Service • Promotion Status"],
  ["/employee/attendance", "Personnel Self-Service • My Attendance"],
  ["/employee", "Personnel Self-Service Dashboard"],
];

const within = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

/** The grey line under the station name in the top bar (Capstone UI jobpost.html header). */
export function staffPageSubtitle(pathname: string) {
  return SUBTITLES.find(([root]) => within(pathname, root))?.[1] ?? "Dashboard • Manpower, Attendance & Deployment Overview";
}

/** Pages copied from a Capstone UI mockup; every other staff page keeps the workspace look. */
const REDESIGNED = new Set([
  "/hr", "/hr/jobs", "/hr/applications", "/hr/deployments", "/hr/leave-requests", "/hr/promotions", "/hr/attendance", "/reports", "/hr/public-site",
  "/employee", "/employee/profile", "/employee/leave", "/employee/deployments", "/employee/promotion-eligibility", "/employee/attendance",
  "/admin", "/admin/users", "/admin/departments", "/admin/unit-stations", "/admin/ranks", "/admin/profile-change-requests", "/admin/integrations/attendance", "/admin/audit-logs", "/admin/settings",
]);
export function isRedesignedStaffRoute(pathname: string) {
  return REDESIGNED.has(pathname);
}
