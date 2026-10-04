import { notFound } from "next/navigation";

import { ApplicantApplyWorkspace } from "@/components/recruitment/applicant-apply-workspace";
import { PageHeader } from "@/components/ui/page-header";

export default async function ApplicantApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = Number(jobId);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();
  return <div className="max-w-3xl space-y-6"><PageHeader description="Save your required documents, then submit your application." title="Apply" /><ApplicantApplyWorkspace jobId={parsed} /></div>;
}
