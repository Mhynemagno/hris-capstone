"use client";

import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs } from "@/components/ui/tabs";
import { notifySuccess } from "@/components/ui/toaster";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useAllHrJobs, useWithdrawJobOpening } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { applicationCount, deadlineNote, DEFAULT_JOB_SORT, filterJobs, jobActions, JOB_SORT_ACCESSORS, JOB_SORT_KEYS, JOB_STATUS_LABELS, jobStatusCounts } from "@/lib/recruitment/job-postings";
import { useListParams } from "@/lib/workspace/list-params";
import { formatSort, paginate, parseSort, sortRows } from "@/lib/workspace/table";
import type { HrJob } from "@/queries/recruitment";

const STATUS_VARIANT = { published: "success", draft: "neutral", closed: "outline" } as const;
const PAGE_SIZE = 25;

export function HrJobPostings() {
  const jobs = useAllHrJobs();
  const withdraw = useWithdrawJobOpening();
  const { params, set, clear } = useListParams(["status", "q", "sort", "page"] as const);
  const [withdrawing, setWithdrawing] = useState<HrJob | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const all = jobs.data ?? [];
  const counts = jobStatusCounts(all);
  const sort = parseSort(params.sort, JOB_SORT_KEYS, DEFAULT_JOB_SORT);
  const filtered = filterJobs(all, { status: params.status, q: params.q });
  const page = paginate(sortRows(filtered, sort, JOB_SORT_ACCESSORS), Number(params.page || 1), PAGE_SIZE);
  const statusTab = params.status in JOB_STATUS_LABELS ? params.status : "all";

  async function confirmWithdraw() {
    if (!withdrawing || withdraw.isPending) return;
    setWithdrawError(null);
    try {
      await withdraw.mutateAsync(withdrawing.id);
      notifySuccess(`“${withdrawing.title}” was withdrawn. Its applications are kept.`);
      setWithdrawing(null);
    } catch (cause) {
      setWithdrawError(cause instanceof Error ? cause.message : "We could not withdraw this posting.");
    }
  }

  const columns: DataTableColumn<HrJob>[] = [
    { key: "title", header: "Posting", sortable: true, cell: (job) => (
      <div className="min-w-0">
        <Link className="font-medium hover:underline" href={`/hr/jobs/${job.id}`}>{job.title}</Link>
        <p className="text-sm text-muted-foreground">{job.location || "Location to be confirmed"}</p>
      </div>
    ) },
    { key: "status", header: "Status", cell: (job) => <Badge variant={STATUS_VARIANT[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge> },
    { key: "applications", header: "Applications", align: "right", cell: (job) => {
      const count = applicationCount(job);
      return <Link aria-label={`${count} applications for ${job.title}`} className="font-medium tabular-nums hover:underline" href={`/hr/applications?job=${job.id}&quick=all`}>{count}</Link>;
    } },
    { key: "deadline", header: "Deadline", sortable: true, hideBelow: "md", cell: (job) => {
      const note = deadlineNote(job.closes_on, job.status);
      return (
        <div>
          <p className="tabular-nums">{formatDate(job.closes_on) ?? "—"}</p>
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        </div>
      );
    } },
    { key: "updated", header: "Updated", sortable: true, hideBelow: "lg", cell: (job) => <span className="tabular-nums text-secondary-foreground">{formatDate(job.updated_at)}</span> },
    { key: "actions", header: "Actions", align: "right", cell: (job) => {
      const { canDelete, canWithdraw } = jobActions(job);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label={`Actions for ${job.title}`} size="icon-sm" variant="ghost" />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/hr/jobs/${job.id}`} />}>Edit</DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/hr/applications?job=${job.id}&quick=all`} />}>View applications</DropdownMenuItem>
            {job.status === "published" ? <DropdownMenuItem render={<a href={`/jobs/${job.id}`} rel="noreferrer" target="_blank" />}>View on public site</DropdownMenuItem> : null}
            {canWithdraw || canDelete ? <DropdownMenuSeparator /> : null}
            {canWithdraw ? <DropdownMenuItem onClick={() => { setWithdrawError(null); setWithdrawing(job); }} variant="destructive">Withdraw</DropdownMenuItem> : null}
            {canDelete ? <DropdownMenuItem onClick={() => setDeletingId(job.id)} variant="destructive">Delete draft</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } },
  ];

  const hasFilters = Boolean(params.q || params.status);

  return (
    <PageContainer width="wide">
      <PageHeader action={<Link className={buttonVariants()} href="/hr/jobs/new"><Plus aria-hidden="true" />New job posting</Link>} title="Job postings" />
      <Tabs
        items={[
          { value: "all", label: "All", count: counts.all },
          { value: "published", label: "Published", count: counts.published },
          { value: "draft", label: "Draft", count: counts.draft },
          { value: "closed", label: "Closed", count: counts.closed },
        ]}
        label="Posting status"
        onValueChange={(value) => set({ status: value === "all" ? "" : value })}
        value={statusTab}
      >
        <div className="space-y-4 pt-4">
          <FilterBar>
            <SearchInput label="Search job postings" onChange={(q) => set({ q })} value={params.q} />
          </FilterBar>
          <DataTable
            caption="Job postings"
            columns={columns}
            empty={hasFilters
              ? <EmptyState action={<Button onClick={() => clear(["q", "status"])} variant="outline">Clear filters</Button>} title="No job postings match" />
              : <EmptyState action={<Link className={buttonVariants()} href="/hr/jobs/new">New job posting</Link>} description="Create a draft when your team is ready to recruit." title="No job postings yet" />}
            error={jobs.error?.message}
            footer={page.total ? <Pagination from={page.from} noun="postings" onPageChange={(next) => set({ page: String(next) })} page={page.page} pageCount={page.pageCount} to={page.to} total={page.total} /> : null}
            getRowHref={(job) => `/hr/jobs/${job.id}`}
            getRowKey={(job) => String(job.id)}
            isLoading={jobs.isLoading}
            loadingLabel="Loading job postings…"
            onRetry={() => void jobs.refetch()}
            onSortChange={(next) => set({ sort: formatSort(next) })}
            rows={page.rows}
            sort={sort}
          />
        </div>
      </Tabs>
      <ConfirmDialog
        confirmLabel="Withdraw"
        description="Applicants can no longer apply. Existing applications stay available for review."
        error={withdrawError}
        onConfirm={confirmWithdraw}
        onOpenChange={(open) => { if (!open) setWithdrawing(null); }}
        open={Boolean(withdrawing)}
        pending={withdraw.isPending}
        title={`Withdraw “${withdrawing?.title ?? ""}”?`}
        tone="danger"
      />
      <DeleteRecordDialog entityId={deletingId} entityType="job_opening" noun="draft posting" onClose={() => setDeletingId(null)} onDeleted={() => notifySuccess("The draft posting was deleted.")} />
    </PageContainer>
  );
}
