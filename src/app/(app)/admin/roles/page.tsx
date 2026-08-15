import { AdminPage } from "@/components/administration/admin-page";
import { RolesWorkspace } from "@/components/administration/administration-workspaces";

export default function RolesPage() { return <AdminPage title="Roles" description="Review account roles and assign the right access."><RolesWorkspace /></AdminPage>; }
