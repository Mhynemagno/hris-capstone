import { notFound } from "next/navigation";

import { HrApplicationDetail } from "@/components/recruitment/hr-application-detail";

export default async function HrApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) notFound();
  return <HrApplicationDetail applicationId={applicationId} />;
}
