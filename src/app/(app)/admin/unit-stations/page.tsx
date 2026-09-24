import { AdminPage } from "@/components/administration/admin-page";
import { UnitStationsWorkspace } from "@/components/administration/administration-workspaces";

export default function UnitStationsPage() { return <AdminPage title="Unit stations" description="Maintain the precincts and units used for personnel assignments and deployments."><UnitStationsWorkspace /></AdminPage>; }
