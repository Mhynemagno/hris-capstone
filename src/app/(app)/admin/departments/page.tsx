import { AdminPage } from "@/components/administration/admin-page";
import { DepartmentsWorkspace } from "@/components/administration/administration-workspaces";

export default function DepartmentsPage() { return <AdminPage title="Departments" description="Maintain the organization’s department reference data."><DepartmentsWorkspace /></AdminPage>; }
