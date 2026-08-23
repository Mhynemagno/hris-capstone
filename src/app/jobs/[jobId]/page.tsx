import { notFound } from "next/navigation";

import { PublicJobDetail } from "@/components/recruitment/public-job-detail";

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = Number(jobId);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();
  return <main className="px-6 py-12"><PublicJobDetail jobId={parsed} /></main>;
}
