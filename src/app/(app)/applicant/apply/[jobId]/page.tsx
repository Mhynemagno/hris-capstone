import { notFound, redirect } from "next/navigation";

/** Applying happens on the Documents page now: it remembers this posting, and Save submits the application. */
export default async function ApplicantApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = Number(jobId);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();
  redirect(`/applicant/documents?apply=${parsed}`);
}
