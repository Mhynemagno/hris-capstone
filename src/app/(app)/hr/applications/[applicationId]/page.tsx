import { notFound } from "next/navigation";

import { HrApplicationReview } from "@/components/recruitment/application-detail/application-review";

export default async function HrApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) notFound();
  return <HrApplicationReview applicationId={applicationId} />;
}
