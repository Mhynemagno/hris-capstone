import { notFound } from "next/navigation";

import { HrJobEditor } from "@/components/recruitment/hr-job-editor";
import { PageHeader } from "@/components/ui/page-header";

export default async function HrJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = Number(jobId);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();
  return <div className="space-y-6"><PageHeader description="Update the role details and qualification criteria." eyebrow="Recruitment" title="Edit job opening" /><HrJobEditor jobId={parsed} /></div>;
}
