import { notFound } from "next/navigation";
import { ProfileChangeRequestView } from "@/components/profile-change-requests/profile-change-request-view";
import { uuidSchema } from "@/schemas/common";
export default async function ProfileChangeRequestPage({ params }: { params: Promise<{ requestId: string }> }) { const { requestId } = await params; if (!uuidSchema.safeParse(requestId).success) notFound(); return <ProfileChangeRequestView requestId={requestId} />; }
