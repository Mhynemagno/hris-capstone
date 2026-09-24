"use client";

import Link from "next/link";
import { useState } from "react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusPanel } from "@/components/ui/status-panel";
import { useHrJobs, useWithdrawJobOpening } from "@/hooks/use-recruitment";

const statusLabels: Record<string, string> = { draft: "Draft", published: "Published", closed: "Closed" };

export function HrJobList() {
  const jobs = useHrJobs({ page: 1, pageSize: 100 });
  const withdrawJob = useWithdrawJobOpening();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmingWithdrawId, setConfirmingWithdrawId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (jobs.isLoading) return <LoadingState label="Loading job openings…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  const rows = jobs.data?.rows ?? [];
  if (!rows.length) return <StatusPanel description="Create a draft opening when your team is ready to begin recruitment." kind="empty" title="No job openings have been created yet" />;

  async function withdraw(id: number, title: string) {
    setActionError(null);
    setNotice(null);
    try {
      await withdrawJob.mutateAsync(id);
      setConfirmingWithdrawId(null);
      setNotice(`“${title}” was withdrawn. Its applications and history are kept.`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "We could not withdraw the opening.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <strong>Withdraw</strong> closes an opening to applicants and keeps its applications. <strong>Delete draft</strong> permanently removes a draft that nobody has applied to.
      </p>
      {actionError ? <ErrorState message={actionError} /> : null}
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      {rows.map((job) => {
        const applicationCount = (job as typeof job & { applications?: Array<{ count: number }> }).applications?.[0]?.count ?? 0;
        const canDelete = job.status === "draft" && applicationCount === 0;
        const canWithdraw = job.status !== "closed" && !canDelete;
        return (
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm" key={job.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  <Link className="rounded-sm underline-offset-4 hover:underline" href={`/hr/jobs/${job.id}`}>{job.title}</Link>
                </h2>
                <p className="text-muted-foreground">{job.location || "Location to be confirmed"}</p>
                <p className="text-sm text-muted-foreground">{applicationCount} {applicationCount === 1 ? "application" : "applications"}</p>
              </div>
              <Badge variant={job.status === "published" ? "default" : "outline"}>{statusLabels[job.status] ?? job.status}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/hr/jobs/${job.id}`}>Edit opening</Link>
              {canDelete ? (
                <Button onClick={() => setDeletingId(job.id)} size="sm" type="button" variant="destructive">Delete draft</Button>
              ) : null}
              {canWithdraw && confirmingWithdrawId !== job.id ? (
                <Button onClick={() => setConfirmingWithdrawId(job.id)} size="sm" type="button" variant="outline">Withdraw opening</Button>
              ) : null}
            </div>
            {confirmingWithdrawId === job.id ? (
              <div className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between" role="group" aria-label={`Confirm withdrawing ${job.title}`}>
                <p>Withdraw “{job.title}”? Applicants can no longer apply. Existing applications stay available for review.</p>
                <div className="flex gap-2">
                  <Button disabled={withdrawJob.isPending} onClick={() => setConfirmingWithdrawId(null)} size="sm" type="button" variant="outline">Keep open</Button>
                  <Button disabled={withdrawJob.isPending} onClick={() => void withdraw(job.id, job.title)} size="sm" type="button" variant="destructive">
                    {withdrawJob.isPending ? "Withdrawing…" : "Confirm withdrawal"}
                  </Button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
      <DeleteRecordDialog
        entityId={deletingId}
        entityType="job_opening"
        noun="draft opening"
        onClose={() => setDeletingId(null)}
        onDeleted={() => setNotice("The draft opening was permanently deleted.")}
      />
    </div>
  );
}
