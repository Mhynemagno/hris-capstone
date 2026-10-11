import { redirect } from "next/navigation";

import { ApplicantApplicationStatus } from "@/components/recruitment/applicant-application-status";
import { PageHeader } from "@/components/ui/page-header";

export default async function ApplicantApplicationsPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const { jobId } = await searchParams;
  const parsedJobId = Number(jobId);
  // Links made before applying moved to the Documents page (bookmarks, login `next` paths) still land there.
  if (Number.isInteger(parsedJobId) && parsedJobId > 0) redirect(`/applicant/documents?apply=${parsedJobId}`);
  return <div className="space-y-8"><PageHeader title="Application Status" /><ApplicantApplicationStatus /></div>;
}
