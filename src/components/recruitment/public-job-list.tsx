"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePublishedJobs } from "@/hooks/use-recruitment";

export function PublicJobList() {
  const jobs = usePublishedJobs({ page: 1, pageSize: 50 });
  if (jobs.isLoading) return <LoadingState label="Loading job openings…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  const rows = jobs.data?.rows ?? [];
  if (!rows.length) return <p className="rounded-xl border p-6 text-sm text-muted-foreground">There are no published job openings right now.</p>;
  return <div className="grid gap-4 md:grid-cols-2">{rows.map((job) => <article className="rounded-xl border bg-card p-5" key={job.id}><p className="text-sm text-muted-foreground">{job.location || "Location to be confirmed"}</p><h2 className="mt-1 text-xl font-semibold">{job.title}</h2><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{job.description}</p><p className="mt-3 text-xs text-muted-foreground">{job.closes_on ? `Applications close ${job.closes_on}` : "Open until filled"}</p><Link className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/jobs/${job.id}`}>View opening</Link></article>)}</div>;
}
