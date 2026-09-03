import { AdminPage } from "@/components/administration/admin-page";
import { UsersWorkspace } from "@/components/administration/administration-workspaces";

export default function UsersPage() { return <AdminPage title="Account management" description="Search, filter, invite, and manage every account and its access role."><UsersWorkspace /></AdminPage>; }
