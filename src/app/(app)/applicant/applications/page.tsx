import { ApplicantApplicationForm } from "@/components/recruitment/applicant-application-form";
import { MyApplicationList } from "@/components/recruitment/my-application-list";

export default async function ApplicantApplicationsPage({ searchParams }: { searchParams: Promise<{ jobId?: string }> }) {
  const { jobId } = await searchParams;
  const parsedJobId = Number(jobId);
  return <main className="space-y-8"><div><p className="text-sm font-medium text-primary">Applicant portal</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">My applications</h1><p className="mt-2 text-muted-foreground">Track each submitted application and its review status.</p></div>{Number.isInteger(parsedJobId) && parsedJobId > 0 ? <ApplicantApplicationForm jobId={parsedJobId} /> : <p className="rounded-xl border p-4 text-sm text-muted-foreground">Choose a published job opening to start a new application.</p>}<section className="space-y-3"><h2 className="text-xl font-semibold">Submitted applications</h2><MyApplicationList /></section></main>;
}
