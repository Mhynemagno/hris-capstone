import { redirect } from "next/navigation";

import { ApplicantStatusCard } from "@/components/recruitment/applicant-status-card";

export default async function ApplicantApplicationsPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const { jobId } = await searchParams;
  const parsedJobId = Number(jobId);
  // Links made before applying moved to the Documents page (bookmarks, login `next` paths) still land there.
  if (Number.isInteger(parsedJobId) && parsedJobId > 0) redirect(`/applicant/documents?apply=${parsedJobId}`);
  return <ApplicantStatusCard />;
}
