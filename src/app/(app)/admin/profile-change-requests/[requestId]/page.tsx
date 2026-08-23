import { notFound } from "next/navigation";
import { AdminProfileChangeRequestDetail } from "@/components/profile-change-requests/admin-profile-change-request-detail";
import { uuidSchema } from "@/schemas/common";
export default async function AdminProfileChangeRequestPage({ params }: { params: Promise<{ requestId: string }> }) { const { requestId } = await params; if (!uuidSchema.safeParse(requestId).success) notFound(); return <AdminProfileChangeRequestDetail requestId={requestId} />; }
