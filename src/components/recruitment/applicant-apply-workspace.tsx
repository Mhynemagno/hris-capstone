"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePublishedJob } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";

import { ApplicantApplicationForm } from "./applicant-application-form";
import { ApplicantProfileDocuments } from "./applicant-profile-documents";

/** Everything needed to apply for one job on one page: the job, the five required documents, and the submit form. */
export function ApplicantApplyWorkspace({ jobId }: { jobId: number }) {
  const job = usePublishedJob(jobId);
  if (job.isLoading) return <LoadingState label="Loading job opening…" />;
  if (job.error) return <ErrorState message={job.error.message} />;
  if (!job.data) return <ErrorState message="This job opening is unavailable or has closed." />;
  return <div className="space-y-6">
    <section aria-labelledby="apply-job-title" className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">Applying for</p>
      <h2 className="mt-1 text-xl font-semibold" id="apply-job-title">{job.data.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{[job.data.location, job.data.closes_on ? `Deadline of Application: ${formatDate(job.data.closes_on)}` : "Open until filled"].filter(Boolean).join(" · ")}</p>
      <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/jobs/${job.data.id}`}>View job details</Link>
    </section>
    <ApplicantProfileDocuments />
    <ApplicantApplicationForm jobId={job.data.id} />
  </div>;
}
