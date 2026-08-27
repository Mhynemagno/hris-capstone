import { notFound } from "next/navigation";

import { HrJobEditor } from "@/components/recruitment/hr-job-editor";

export default async function HrJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = Number(jobId);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();
  return <div className="space-y-6"><div><p className="text-sm font-medium text-primary">Recruitment</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Edit job opening</h1></div><HrJobEditor jobId={parsed} /></div>;
}
