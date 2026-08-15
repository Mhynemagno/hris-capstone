import { AdminPage } from "@/components/administration/admin-page";
import { SettingsWorkspace } from "@/components/administration/administration-workspaces";

export default function SettingsPage() { return <AdminPage title="Settings" description="Configure organization information without exposing secrets."><SettingsWorkspace /></AdminPage>; }
