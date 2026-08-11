import { AdminEmptyState, AdminPage } from "@/components/administration/admin-page";
export default function DepartmentsPage() { return <AdminPage title="Departments" description="Maintain the organization’s department reference data."><AdminEmptyState title="Departments" description="Create, edit, and deactivate departments without deleting historical records." /></AdminPage>; }
