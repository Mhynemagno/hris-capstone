import { AdminEmptyState, AdminPage } from "@/components/administration/admin-page";
export default function AuditLogsPage() { return <AdminPage title="Audit logs" description="Review the immutable history of administrative changes."><AdminEmptyState title="Audit history" description="Role and activation actions are written to the protected audit log." /></AdminPage>; }
