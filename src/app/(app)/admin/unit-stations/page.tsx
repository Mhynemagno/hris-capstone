import { AdminPage } from "@/components/administration/admin-page";
import { UnitStationsWorkspace } from "@/components/administration/administration-workspaces";

export default function UnitStationsPage() { return <AdminPage title="Units / Stations" description="Maintain the sub-stations and units used for personnel assignments."><UnitStationsWorkspace /></AdminPage>; }
