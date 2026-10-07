import Link from "next/link";
import { AdminPage as AdminWorkspacePage } from "@/components/administration/admin-page";

export default function AdminPage() {
  return <AdminWorkspacePage title="Dashboard"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Approvals","/admin/profile-change-requests"],["Accounts","/admin/users"],["Audit log","/admin/audit-logs"],["Units / Sections","/admin/departments"],["Ranks","/admin/ranks"],["Units / Stations","/admin/unit-stations"],["Settings","/admin/settings"],["Attendance integration","/admin/integrations/attendance"]].map(([label,href]) => <Link key={href} href={href} className="rounded-xl border bg-card p-5 font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{label}</Link>)}</div></AdminWorkspacePage>;
}
