import Link from "next/link";
import { AdminPage as AdminWorkspacePage } from "@/components/administration/admin-page";

export default function AdminPage() {
  return <AdminWorkspacePage title="Administration workspace" description="Manage accounts, organization reference data, system settings, and audit history."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Users","/admin/users"],["Roles","/admin/roles"],["Departments","/admin/departments"],["Positions","/admin/positions"],["Settings","/admin/settings"],["Audit logs","/admin/audit-logs"]].map(([label,href]) => <Link key={href} href={href} className="rounded-xl border bg-card p-5 font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{label}</Link>)}</div></AdminWorkspacePage>;
}
