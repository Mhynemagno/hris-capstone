import { Suspense } from "react";

import { AdminPage } from "@/components/administration/admin-page";
import { AdminProfileChangeRequestQueue } from "@/components/profile-change-requests/admin-profile-change-request-queue";

export default function HrProfileChangeRequestsPage() {
  return (
    <AdminPage title="Profile Change Requests" description="Review employees' requests to correct their personal records and approve or reject them.">
      <Suspense><AdminProfileChangeRequestQueue basePath="/hr/profile-requests" /></Suspense>
    </AdminPage>
  );
}
