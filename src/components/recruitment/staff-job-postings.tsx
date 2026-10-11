"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Ban, Eye, Plus, Search, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton, staffIconButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDeleteRecord } from "@/hooks/use-deletion";
import { usePanelParam } from "@/hooks/use-panel-param";
import { useAllHrJobs, useWithdrawJobOpening } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { applicationCount, deadlineNote, DEFAULT_JOB_SORT, filterJobs, jobActions, JOB_SORT_ACCESSORS, JOB_STATUS_LABELS, jobStatusCounts } from "@/lib/recruitment/job-postings";
import { nextSort, paginate, sortRows, type SortState } from "@/lib/workspace/table";
import { cn } from "@/lib/utils";
import type { HrJob } from "@/queries/recruitment";

const PAGE_SIZE = 10;
const TABS = [
  { value: "all", label: "All", chip: "bg-slate-100 text-slate-700" },
  { value: "published", label: "Published", chip: "bg-emerald-100 text-emerald-800" },
  { value: "draft", label: "Draft", chip: "bg-slate-200 text-slate-700" },
  { value: "closed", label: "Closed", chip: "bg-slate-200 text-slate-700" },
] as const;

function SortHeader({ label, sortKey, sort, onSort, className }: { label: string; sortKey: string; sort: SortState; onSort: (key: string) => void; className?: string }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "desc" ? ArrowDown : ArrowUp;
  return (
    <th aria-sort={active ? (sort.direction === "desc" ? "descending" : "ascending") : "none"} className={cn(staffTable.th, className)} scope="col">
      <button className="inline-flex items-center gap-1 uppercase hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => onSort(sortKey)} type="button">
        {label}<Icon aria-hidden="true" className={cn("size-2.5", active ? "text-slate-700" : "text-slate-400")} />
      </button>
    </th>
  );
}

/** Recruitment Openings (Capstone UI jobpost.html, PDF p. 21). */
export function StaffJobPostings() {
  const jobs = useAllHrJobs();
  const remove = useDeleteRecord("job_opening");
  const withdraw = useWithdrawJobOpening();
  const [statusParam, setStatus] = usePanelParam("status");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(DEFAULT_JOB_SORT);
  const [page, setPage] = useState(1);

  if (jobs.isLoading) return <LoadingState label="Loading job postings…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} onRetry={() => void jobs.refetch()} />;

  const all = jobs.data ?? [];
  const status = statusParam && statusParam in JOB_STATUS_LABELS ? statusParam : "all";
  const counts = jobStatusCounts(all);
  const visible = paginate(sortRows(filterJobs(all, { status: status === "all" ? "" : status, q: query }), sort, JOB_SORT_ACCESSORS), page, PAGE_SIZE);

  async function deletePosting(job: HrJob) {
    if (!window.confirm("Are you sure you want to delete this posting?")) return;
    try {
      await remove.mutateAsync({ entityId: job.id });
      notifyStaff({ title: "Posting deleted" });
    } catch (error) {
      notifyStaff({ title: "Could not delete posting", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function withdrawPosting(job: HrJob) {
    if (!window.confirm("Withdraw this posting? It closes to applicants; its applications are kept.")) return;
    try {
      await withdraw.mutateAsync(job.id);
      notifyStaff({ title: "Posting withdrawn" });
    } catch (error) {
      notifyStaff({ title: "Could not withdraw posting", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        actions={<Link className={staffButton.primary} href="/hr/jobs/new"><Plus aria-hidden="true" className="size-3.5" /><span>Create Recruitment</span></Link>}
        subtitle="Manage recruitment openings and vacancies for San Juan City Police Station."
        title="RECRUITMENT OPENINGS"
      />

      <section aria-label="Job postings" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center">
          <div aria-label="Posting status" className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-200/60 p-1 text-xs font-bold text-slate-600" role="group">
            {TABS.map((tab) => (
              <button
                aria-label={`${tab.label} ${counts[tab.value]}`}
                aria-pressed={status === tab.value}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", status === tab.value ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900")}
                key={tab.value}
                onClick={() => { setStatus(tab.value === "all" ? null : tab.value); setPage(1); }}
                type="button"
              >
                <span>{tab.label}</span>
                <span className={cn("rounded-md px-1.5 font-mono text-[10px]", tab.chip)}>{counts[tab.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <input
              aria-label="Search job postings"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-9 text-xs font-medium transition-all focus:ring-2 focus:ring-blue-600 focus:outline-none"
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="Search job postings..."
              type="search"
              value={query}
            />
            <Search aria-hidden="true" className="absolute top-1/2 left-3.5 size-3 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={staffTable.table}>
            <thead className={staffTable.thead}>
              <tr className="border-b border-slate-100">
                <SortHeader label="Posting Title" onSort={(key) => setSort(nextSort(sort, key))} sort={sort} sortKey="title" />
                <th className={staffTable.th} scope="col">Status</th>
                <th className={cn(staffTable.th, "text-center")} scope="col">Applications</th>
                <SortHeader label="Deadline" onSort={(key) => setSort(nextSort(sort, key))} sort={sort} sortKey="deadline" />
                <SortHeader label="Updated" onSort={(key) => setSort(nextSort(sort, key))} sort={sort} sortKey="updated" />
                <th className={cn(staffTable.th, "text-center")} scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className={staffTable.tbody}>
              {visible.rows.length ? visible.rows.map((job) => {
                const count = applicationCount(job);
                const note = deadlineNote(job.closes_on, job.status);
                const actions = jobActions(job);
                return (
                  <tr className={staffTable.tr} key={job.id}>
                    <td className={staffTable.td}>
                      <p className="text-sm font-bold text-slate-900">{job.title}</p>
                      {job.location ? <p className="text-[11px] text-slate-500">{job.location}</p> : null}
                    </td>
                    <td className={staffTable.td}><StatusPill tone={job.status === "published" ? "emerald" : "slate"}>{JOB_STATUS_LABELS[job.status]}</StatusPill></td>
                    <td className={cn(staffTable.td, "text-center")}><span className={cn("font-mono text-sm font-bold", count ? "text-slate-900" : "text-slate-500")}>{count}</span></td>
                    <td className={staffTable.td}>
                      <p className="font-semibold text-slate-800">{formatDate(job.closes_on) ?? "No deadline"}</p>
                      {note ? <p className={cn("text-[10px] font-bold", note.startsWith("Closes") ? "text-emerald-700" : "text-slate-500")}>{note}</p> : null}
                    </td>
                    <td className={cn(staffTable.td, "text-slate-500")}>{formatDate(job.updated_at)}</td>
                    <td className={staffTable.td}>
                      <div className="flex items-center justify-center gap-1.5">
                        <Link aria-label="View Posting" className={cn(staffIconButton, "hover:bg-blue-50 hover:text-blue-600")} href={`/jobs/${job.id}`} title="View Posting"><Eye aria-hidden="true" className="size-3.5" /></Link>
                        <Link aria-label="Edit Posting" className={cn(staffIconButton, "hover:bg-amber-50 hover:text-amber-600")} href={`/hr/jobs/${job.id}`} title="Edit Posting"><SquarePen aria-hidden="true" className="size-3.5" /></Link>
                        {actions.canDelete ? (
                          <button aria-label="Delete Posting" className={cn(staffIconButton, "hover:bg-rose-50 hover:text-rose-600")} disabled={remove.isPending} onClick={() => void deletePosting(job)} title="Delete Posting" type="button"><Trash2 aria-hidden="true" className="size-3.5" /></button>
                        ) : actions.canWithdraw ? (
                          <button aria-label="Withdraw Posting" className={cn(staffIconButton, "hover:bg-rose-50 hover:text-rose-600")} disabled={withdraw.isPending} onClick={() => void withdrawPosting(job)} title="Withdraw Posting" type="button"><Ban aria-hidden="true" className="size-3.5" /></button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={6}>No job postings match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <StaffPager noun="postings" onPageChange={setPage} page={visible.page} pageSize={PAGE_SIZE} total={visible.total} />
      </section>
    </div>
  );
}
