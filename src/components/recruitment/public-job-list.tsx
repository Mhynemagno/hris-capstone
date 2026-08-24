"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { usePublishedJobs } from "@/hooks/use-recruitment";

type PublicJobListProps = {
  pageSize?: number;
  featured?: boolean;
};

export function PublicJobList({ pageSize = 50, featured = false }: PublicJobListProps) {
  const jobs = usePublishedJobs({ page: 1, pageSize });
  if (jobs.isLoading) return <LoadingState label="Loading job openings…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  const rows = jobs.data?.rows ?? [];
  if (!rows.length) {
    return (
      <StatusPanel
        description="Please check again soon for the next recruitment announcement."
        kind="empty"
        title="No published openings are available right now"
      />
    );
  }
  return <div className={featured ? "grid gap-4 lg:grid-cols-3" : "grid gap-4 md:grid-cols-2"}>{rows.map((job) => <article aria-labelledby={`job-${job.id}-title`} className="rounded-xl border border-border bg-card p-5 shadow-sm" key={job.id}><p className="text-sm text-muted-foreground">{job.location || "Location to be confirmed"}</p><h2 className="mt-1 text-xl font-semibold" id={`job-${job.id}-title`}>{job.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{job.description}</p><p className="mt-3 text-xs font-medium text-muted-foreground">{job.closes_on ? `Applications close ${job.closes_on}` : "Open until filled"}</p><Link aria-label={`View ${job.title} opening`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={`/jobs/${job.id}`}>View opening</Link></article>)}</div>;
}
