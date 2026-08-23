"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrJobs } from "@/hooks/use-recruitment";

export function HrJobList() {
  const jobs = useHrJobs({ page: 1, pageSize: 100 });
  if (jobs.isLoading) return <LoadingState label="Loading job openings…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  const rows = jobs.data?.rows ?? [];
  if (!rows.length) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">No job openings have been created yet.</p>;
  return <div className="space-y-3">{rows.map((job) => <Link className="block rounded-xl border p-4 hover:bg-muted" href={`/hr/jobs/${job.id}`} key={job.id}><div className="flex items-center justify-between gap-3"><span className="font-medium">{job.title}</span><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{job.status}</span></div><p className="mt-1 text-sm text-muted-foreground">{job.location || "Location to be confirmed"}</p></Link>)}</div>;
}
