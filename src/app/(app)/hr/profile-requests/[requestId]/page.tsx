import { notFound } from "next/navigation";

import { AdminProfileChangeRequestDetail } from "@/components/profile-change-requests/admin-profile-change-request-detail";
import { uuidSchema } from "@/schemas/common";

export default async function HrProfileChangeRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  if (!uuidSchema.safeParse(requestId).success) notFound();
  return <AdminProfileChangeRequestDetail backLabel="Back to Profile Change Requests" basePath="/hr/profile-requests" requestId={requestId} />;
}
