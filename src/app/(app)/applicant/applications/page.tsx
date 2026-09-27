import { ApplicantApplicationForm } from "@/components/recruitment/applicant-application-form";
import { ApplicantApplicationStatus } from "@/components/recruitment/applicant-application-status";
import { PageHeader } from "@/components/ui/page-header";

export default async function ApplicantApplicationsPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const { jobId } = await searchParams;
  const parsedJobId = Number(jobId);
  return <div className="space-y-8"><PageHeader title="Application Status" />{Number.isInteger(parsedJobId) && parsedJobId > 0 ? <ApplicantApplicationForm jobId={parsedJobId} /> : null}<ApplicantApplicationStatus /></div>;
}
