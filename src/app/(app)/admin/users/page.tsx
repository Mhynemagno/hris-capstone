import { AdminPage } from "@/components/administration/admin-page";
import { UsersWorkspace } from "@/components/administration/administration-workspaces";

export default function UsersPage() { return <AdminPage title="Users" description="Search, filter, invite, and manage every account, including applicants."><UsersWorkspace /></AdminPage>; }
