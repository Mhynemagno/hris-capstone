"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { usePublishedJobs } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";

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
  // On the landing page the list sits under a section heading; on /jobs it sits under the page title.
  const Heading = featured ? "h3" : "h2";
  return (
    <div className={featured ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "grid gap-4"}>
      {rows.map((job) => (
        <article
          aria-labelledby={`job-${job.id}-title`}
          className={featured
            ? "flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
            : "flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"}
          key={job.id}
        >
          <div>
            <Heading className="text-lg font-semibold" id={`job-${job.id}-title`}>{job.title}</Heading>
            <p className="mt-1 text-sm text-muted-foreground">{job.closes_on ? `Deadline of Application: ${formatDate(job.closes_on)}` : "Open until filled"}</p>
          </div>
          <Link
            aria-label={`View details for ${job.title}`}
            className="inline-flex min-h-11 w-fit shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            href={`/jobs/${job.id}`}
          >
            View details
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </article>
      ))}
    </div>
  );
}
