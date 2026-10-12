"use client";

import { CircleCheck, FolderOpen, Info, ListChecks, ThumbsUp, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { InitialsAvatar, avatarTone } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffSlideOver } from "@/components/staff-shell/ui/staff-slide-over";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { SearchInput } from "@/components/ui/search-input";
import { useRankOptions } from "@/hooks/use-administration";
import { usePanelParam } from "@/hooks/use-panel-param";
import { usePromotionReadinessPage } from "@/hooks/use-promotion-eligibility";
import { formatDate } from "@/lib/format-date";
import { rankLabel } from "@/lib/ranks";
import { RECOMMENDATION_STATUS } from "@/lib/staff/status-maps";
import { cn } from "@/lib/utils";

import { PromotionCriteriaManager } from "./promotion-criteria-manager";
import { PromotionReviewModal } from "./promotion-review-modal";

const PAGE_SIZE = 10;

/** Promotions Evaluation (Capstone UI promotions.html, PDF pp. 28–30). Criteria and reviews open in place. */
export function StaffPromotions() {
  const [criteria, setCriteria] = usePanelParam("criteria");
  const [review, setReview] = usePanelParam("review");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // Searched on the server across every page: each word must match the name, badge number or target rank.
  const readiness = usePromotionReadinessPage({ page, pageSize: PAGE_SIZE, search: search || undefined });
  const ranks = useRankOptions();

  const rankTitle = (rankId: number) => {
    const rank = ranks.data?.find((row) => row.id === rankId);
    return rank ? rankLabel(rank) : `Rank #${rankId}`;
  };
  const rows = readiness.data?.rows ?? [];
  const total = readiness.data?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        actions={<button className={staffButton.dark} onClick={() => setCriteria("1")} type="button"><ListChecks aria-hidden="true" className="size-3.5 text-amber-400" /><span>Manage Criteria</span></button>}
        subtitle="Review rank readiness and eligibility without automatically changing employee records."
        title="Promotions Evaluation"
      />

      <div className="flex items-center gap-3.5 rounded-2xl border border-blue-800/60 bg-gradient-to-r from-blue-900 to-slate-900 p-4 text-white shadow-sm">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/20 text-amber-300">
          <Info aria-hidden="true" className="size-4" />
        </div>
        <div className="text-xs">
          <p className="font-bold text-amber-300">Promotion Board Guidelines</p>
          <p className="text-[11px] leading-relaxed text-slate-300">
            Promotion reviews advise HR Admin on candidate readiness based on Time-in-Grade and mandatory training courses. Submissions do not alter ranks automatically.
          </p>
        </div>
      </div>

      <section aria-label="Candidates for Promotion" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Candidates for Promotion</h2>
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700">{total} {total === 1 ? "Candidate" : "Candidates"}</span>
          </div>
          <SearchInput className="sm:w-full md:w-64" label="Search candidates" onChange={(next) => { setSearch(next); setPage(1); }} placeholder="Search employee, badge no. or rank..." value={search} variant="staff" />
        </div>
        {readiness.isLoading ? <LoadingState label="Loading promotion reviews…" /> : readiness.error ? <ErrorState message={readiness.error.message} onRetry={() => void readiness.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className={staffTable.table}>
              <thead className={staffTable.thead}>
                <tr className="border-b border-slate-100">
                  {["Employee", "Target Rank", "Last Reviewed", "Status", "Recommendation"].map((heading) => <th className={staffTable.th} key={heading} scope="col">{heading}</th>)}
                  <th className={cn(staffTable.th, "text-center")} scope="col">Action</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {rows.length ? rows.map((row) => {
                  const title = rankTitle(row.target_rank_id);
                  const recommendation = RECOMMENDATION_STATUS[row.recommendation];
                  return (
                    <tr className={staffTable.tr} key={row.employee_id}>
                      <td className={staffTable.td}>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={row.employee_name} size="lg" tone={avatarTone(row.employee_name)} />
                          <p className="text-sm font-bold text-slate-900">{row.employee_name}</p>
                        </div>
                      </td>
                      <td className={staffTable.td}><span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{title}</span></td>
                      <td className={cn(staffTable.td, "font-semibold text-slate-600")}>{formatDate(row.evaluated_on)}</td>
                      <td className={staffTable.td}>
                        {row.readiness.isReady
                          ? <StatusPill icon={<CircleCheck aria-hidden="true" className="size-3 text-emerald-600" />} tone="emerald">Ready</StatusPill>
                          : <StatusPill icon={<TriangleAlert aria-hidden="true" className="size-3 text-amber-600" />} tone="amber">Not Ready</StatusPill>}
                      </td>
                      <td className={staffTable.td}>
                        {recommendation ? <StatusPill icon={<ThumbsUp aria-hidden="true" className="size-3" />} tone={recommendation.tone}>{recommendation.label}</StatusPill> : <span className="text-slate-500">—</span>}
                      </td>
                      <td className={cn(staffTable.td, "text-center")}>
                        <button aria-label={`Open review for ${row.employee_name}, ${title}`} className="mx-auto flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setReview(row.employee_id)} type="button">
                          <FolderOpen aria-hidden="true" className="size-3.5" /><span>Open Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                }) : <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={6}>No promotion reviews yet. Open an employee&apos;s record and choose Promotion review to start one.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <StaffPager noun="promotion reviews" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />
      </section>

      <StaffSlideOver
        footer={<button className={staffButton.dark} onClick={() => setCriteria(null)} type="button">Close</button>}
        onClose={() => setCriteria(null)}
        open={criteria === "1"}
        size="xl"
        subtitle="Configure criteria requirements for rank progression."
        title="Promotion Criteria"
      >
        <PromotionCriteriaManager />
      </StaffSlideOver>
      {review ? <PromotionReviewModal employeeId={review} onClose={() => setReview(null)} /> : null}
    </div>
  );
}
