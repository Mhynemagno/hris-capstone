"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useHrJobs } from "@/hooks/use-recruitment";

export function HrJobList() {
  const jobs = useHrJobs({ page: 1, pageSize: 100 });
  if (jobs.isLoading) return <LoadingState label="Loading job openings…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  const rows = jobs.data?.rows ?? [];
  if (!rows.length) return <StatusPanel description="Create a draft opening when your team is ready to begin recruitment." kind="empty" title="No job openings have been created yet" />;
  return <div className="space-y-3">{rows.map((job) => <Link className="block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={`/hr/jobs/${job.id}`} key={job.id}><div className="flex items-center justify-between gap-3"><span className="font-semibold">{job.title}</span><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize">{job.status}</span></div><p className="mt-2 text-sm text-muted-foreground">{job.location || "Location to be confirmed"}</p></Link>)}</div>;
}
