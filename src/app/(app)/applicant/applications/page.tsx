import { redirect } from "next/navigation";

import { ApplicantApplicationStatus } from "@/components/recruitment/applicant-application-status";
import { PageHeader } from "@/components/ui/page-header";

export default async function ApplicantApplicationsPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const { jobId } = await searchParams;
  const parsedJobId = Number(jobId);
  // Links made before the one-page apply flow (bookmarks, login `next` paths) still land on the form.
  if (Number.isInteger(parsedJobId) && parsedJobId > 0) redirect(`/applicant/apply/${parsedJobId}`);
  return <div className="space-y-8"><PageHeader title="Application Status" /><ApplicantApplicationStatus /></div>;
}
