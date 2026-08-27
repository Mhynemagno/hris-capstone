import { notFound } from "next/navigation";

import { ApplicantApplicationDetail } from "@/components/recruitment/applicant-application-detail";

export default async function ApplicantApplicationDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) notFound();
  return <ApplicantApplicationDetail applicationId={applicationId} />;
}
