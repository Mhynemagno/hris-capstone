"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useDeleteDraftJobOpening, useHrJobs, useWithdrawJobOpening } from "@/hooks/use-recruitment";

export function HrJobList() {
  const jobs = useHrJobs({ page: 1, pageSize: 100 });
  const deleteDraft = useDeleteDraftJobOpening();
  const withdrawJob = useWithdrawJobOpening();
  if (jobs.isLoading) return <LoadingState label="Loading job openings…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  const rows = jobs.data?.rows ?? [];
  if (!rows.length) return <StatusPanel description="Create a draft opening when your team is ready to begin recruitment." kind="empty" title="No job openings have been created yet" />;
  const isPending = deleteDraft.isPending || withdrawJob.isPending;
  return <div className="space-y-3">{rows.map((job) => <article className="rounded-xl border border-border bg-card p-5 shadow-sm" key={job.id}><Link className="block rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={`/hr/jobs/${job.id}`}><div className="flex items-center justify-between gap-3"><span className="font-semibold">{job.title}</span><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize">{job.status}</span></div><p className="mt-2 text-sm text-muted-foreground">{job.location || "Location to be confirmed"}</p></Link><div className="mt-4 flex flex-wrap gap-2"><Link className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted" href={`/hr/jobs/${job.id}`}>Edit opening</Link>{job.status === "draft" ? <button className="rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60" disabled={isPending} onClick={() => { if (window.confirm(`Delete the draft opening “${job.title}”? This cannot be undone.`)) deleteDraft.mutate(job.id); }} type="button">Delete draft</button> : null}{job.status !== "closed" && job.status !== "draft" ? <button className="rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60" disabled={isPending} onClick={() => { if (window.confirm(`Withdraw “${job.title}” from recruitment?`)) withdrawJob.mutate(job.id); }} type="button">Withdraw opening</button> : null}</div></article>)}</div>;
}
