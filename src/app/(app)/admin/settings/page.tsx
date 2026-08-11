import { AdminEmptyState, AdminPage } from "@/components/administration/admin-page";
export default function SettingsPage() { return <AdminPage title="Settings" description="Configure organization information without exposing secrets."><AdminEmptyState title="Organization settings" description="Organization name, support email, and time zone are securely stored here." /></AdminPage>; }
