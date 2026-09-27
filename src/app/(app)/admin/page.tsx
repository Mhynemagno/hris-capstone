import Link from "next/link";
import { AdminPage as AdminWorkspacePage } from "@/components/administration/admin-page";

export default function AdminPage() {
  return <AdminWorkspacePage title="Dashboard"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Reviews & Approvals","/admin/profile-change-requests"],["Account Management","/admin/users"],["Audit logs","/admin/audit-logs"],["Departments","/admin/departments"],["Ranks","/admin/ranks"],["Units","/admin/unit-stations"],["Settings","/admin/settings"],["Attendance Integration","/admin/integrations/attendance"]].map(([label,href]) => <Link key={href} href={href} className="rounded-xl border bg-card p-5 font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{label}</Link>)}</div></AdminWorkspacePage>;
}
