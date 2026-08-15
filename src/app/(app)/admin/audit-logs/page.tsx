import { AdminPage } from "@/components/administration/admin-page";
import { AuditLogsWorkspace } from "@/components/administration/administration-workspaces";

export default function AuditLogsPage() { return <AdminPage title="Audit logs" description="Review the immutable history of administrative changes."><AuditLogsWorkspace /></AdminPage>; }
