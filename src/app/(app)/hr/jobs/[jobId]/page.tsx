import { notFound } from "next/navigation";

import { HrJobEditor } from "@/components/recruitment/hr-job-editor";

export default async function HrJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = Number(jobId);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();
  return <HrJobEditor jobId={parsed} />;
}
