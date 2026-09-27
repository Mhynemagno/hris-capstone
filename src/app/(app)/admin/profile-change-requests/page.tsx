import { AdminPage } from "@/components/administration/admin-page";
import { AdminProfileChangeRequestQueue } from "@/components/profile-change-requests/admin-profile-change-request-queue";
export default function AdminProfileChangeRequestsPage() { return <AdminPage title="Reviews & Approvals" description="Review employee profile-change requests and approve or reject them."><AdminProfileChangeRequestQueue /></AdminPage>; }
