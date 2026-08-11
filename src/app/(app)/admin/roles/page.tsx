import { AdminEmptyState, AdminPage } from "@/components/administration/admin-page";
export default function RolesPage() { return <AdminPage title="Roles" description="Review account roles and assign the right access."><AdminEmptyState title="Role assignments" description="Role changes are protected and audited by the administration workflow." /></AdminPage>; }
