"use client";

import Link from "next/link";

import { ApplicationStatusTracker } from "@/components/recruitment/application-status-tracker";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyApplicationStatuses } from "@/hooks/use-applicant-portal";
import { formatDate } from "@/lib/format-date";
import { PIPELINE_STAGES } from "@/lib/recruitment/application-stages";
import type { Application } from "@/lib/types/database";

type ApplicationWithOpening = Application & { job_openings?: { title?: string; location?: string } | null };

export function ApplicantApplicationStatus() {
  const applications = useMyApplicationStatuses();

  if (applications.isLoading) return <LoadingState label="Loading application status…" />;
  if (applications.error) return <ErrorState message={applications.error.message} />;
  const rows = (applications.data?.rows ?? []) as ApplicationWithOpening[];

  return <div className="space-y-6">
    <section aria-labelledby="application-status-heading" className="space-y-4">
      <h2 className="sr-only" id="application-status-heading">Status of your applications</h2>
      {rows.length === 0 ? <div className="rounded-xl border p-5 text-sm">
        <p className="text-muted-foreground">You have not submitted any applications yet.</p>
        <Link className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline" href="/jobs">Browse job openings</Link>
      </div> : rows.map((application) => (
        <article aria-label={application.job_openings?.title ?? "Application"} className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" key={application.id}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-bold">{application.job_openings?.title ?? `Application ${application.id.slice(0, 8)}`}</h3>
              <p className="text-sm text-muted-foreground">Submitted {formatDate(application.submitted_at)}</p>
              <p className="mt-1 text-sm font-medium text-primary">{Math.max(0, PIPELINE_STAGES.indexOf(application.status) + 1) || PIPELINE_STAGES.length} / {PIPELINE_STAGES.length}</p>
            </div>
            <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/applicant/applications/${application.id}`}>View application</Link>
          </div>
          <ApplicationStatusTracker status={application.status} />
        </article>
      ))}
    </section>
  </div>;
}
