import { AdminPage } from "@/components/administration/admin-page";
import { RanksWorkspace } from "@/components/administration/administration-workspaces";

export default function RanksPage() { return <AdminPage title="Ranks" description="Maintain the police ranks available to every department."><RanksWorkspace /></AdminPage>; }
