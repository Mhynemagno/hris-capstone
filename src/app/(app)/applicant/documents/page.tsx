import { ApplicantProfileDocuments } from "@/components/recruitment/applicant-profile-documents";

/** `?apply=<posting id>` comes from "Apply" on a posting: the Documents page remembers that posting. */
export default async function ApplicantDocumentsPage({ searchParams }: { searchParams: Promise<{ apply?: string }> }) {
  const { apply } = await searchParams;
  const jobId = Number(apply);
  return <ApplicantProfileDocuments applyJobId={Number.isInteger(jobId) && jobId > 0 ? jobId : null} />;
}
