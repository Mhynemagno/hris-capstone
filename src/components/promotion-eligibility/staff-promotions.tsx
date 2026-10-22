"use client";

import { CircleCheck, CircleX, ClipboardCheck, Eye, Info, ListChecks } from "lucide-react";
import { useState } from "react";

import { InitialsAvatar, avatarTone } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffSelect } from "@/components/staff-shell/ui/staff-fields";
import { StaffSlideOver } from "@/components/staff-shell/ui/staff-slide-over";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { SearchInput } from "@/components/ui/search-input";
import { useRankOptions } from "@/hooks/use-administration";
import { usePanelParam } from "@/hooks/use-panel-param";
import { usePromotionCandidates, usePromotionRankRequirements } from "@/hooks/use-promotion-eligibility";
import { OFFICIAL_PROMOTION_POLICIES } from "@/lib/promotion-policies";
import { PROMOTION_STATUS } from "@/lib/staff/status-maps";
import type { PromotionStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import { PromotionDecisionDialog, type PromotionDecisionTarget } from "./promotion-decision-dialog";
import { PromotionDetailsModal } from "./promotion-details-modal";
import { RecordIperPftDialog } from "./record-iper-pft-dialog";

const PAGE_SIZE = 10;
const STATUS_FILTERS: { value: "" | PromotionStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "for_approval", label: "For approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/** Promotion Evaluation (Final Revisions PDF pp. 10–11): the system lists qualified personnel; HR approves or rejects. */
export function StaffPromotions() {
  const [criteria, setCriteria] = usePanelParam("criteria");
  const [view, setView] = usePanelParam("view");
  const [recording, setRecording] = useState(false);
  const [deciding, setDeciding] = useState<PromotionDecisionTarget | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | PromotionStatus>("");
  // Searched on the server across every page: each word must match the name, badge number or a rank.
  const candidates = usePromotionCandidates({ page, pageSize: PAGE_SIZE, search: search || undefined, status: status || undefined });
  const rows = candidates.data?.rows ?? [];
  const total = candidates.data?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        actions={<>
          <button className={staffButton.secondary} onClick={() => setRecording(true)} type="button"><ClipboardCheck aria-hidden="true" className="size-3.5 text-blue-700" /><span>Record IPER / PFT</span></button>
          <button className={staffButton.dark} onClick={() => setCriteria("1")} type="button"><ListChecks aria-hidden="true" className="size-3.5 text-amber-400" /><span>Official policy matrix</span></button>
        </>}
        subtitle="Personnel who meet the requirements for their next rank, evaluated automatically from their records."
        title="Promotions Evaluation"
      />

      <div className="flex items-center gap-3.5 rounded-2xl border border-blue-800/60 bg-gradient-to-r from-blue-900 to-slate-900 p-4 text-white shadow-sm">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/20 text-amber-300">
          <Info aria-hidden="true" className="size-4" />
        </div>
        <div className="text-xs">
          <p className="font-bold text-amber-300">Promotion Board Guidelines</p>
          <p className="text-[11px] leading-relaxed text-slate-300">
            The system lists personnel who meet the requirements for their next rank. HR approves or rejects; approval does not change the rank automatically.
          </p>
        </div>
      </div>

      <section aria-label="Candidates for Promotion" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Candidates for Promotion</h2>
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700">{total} {total === 1 ? "Candidate" : "Candidates"}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="sm:w-44">
              <label className="sr-only" htmlFor="promotion-status-filter">Status</label>
              <StaffSelect id="promotion-status-filter" onChange={(event) => { setStatus(event.target.value as "" | PromotionStatus); setPage(1); }} value={status}>
                {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </StaffSelect>
            </div>
            <SearchInput className="sm:w-full md:w-64" label="Search candidates" onChange={(next) => { setSearch(next); setPage(1); }} placeholder="Search employee, badge no. or rank..." value={search} variant="staff" />
          </div>
        </div>
        {candidates.isLoading ? <LoadingState label="Evaluating personnel…" /> : candidates.error ? <ErrorState message={candidates.error.message} onRetry={() => void candidates.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className={staffTable.table}>
              <thead className={staffTable.thead}>
                <tr className="border-b border-slate-100">
                  {["Rank", "Name", "Target Rank", "Status"].map((heading) => <th className={staffTable.th} key={heading} scope="col">{heading}</th>)}
                  <th className={cn(staffTable.th, "text-center")} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {rows.length ? rows.map((row) => {
                  const pill = PROMOTION_STATUS[row.status];
                  return (
                    <tr className={staffTable.tr} key={row.employee_id}>
                      <td className={staffTable.td}><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-700" title={row.rank_name}>{row.rank_code}</span></td>
                      <td className={staffTable.td}>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={row.employee_name} size="lg" tone={avatarTone(row.employee_name)} />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{row.employee_name}</p>
                            <p className="font-mono text-[10px] text-slate-500">Badge {row.employee_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className={staffTable.td}><span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{row.target_rank_code} — {row.target_rank_name}</span></td>
                      <td className={staffTable.td}><StatusPill tone={pill.tone}>{pill.label}</StatusPill></td>
                      <td className={cn(staffTable.td, "text-center")}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button aria-label={`View details for ${row.employee_name}`} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setView(row.employee_id)} type="button">
                            <Eye aria-hidden="true" className="size-3.5" />View
                          </button>
                          {row.status === "for_approval" ? (
                            <>
                              <button aria-label={`Approve promotion of ${row.employee_name} to ${row.target_rank_code}`} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" onClick={() => setDeciding({ employeeId: row.employee_id, employeeName: row.employee_name, targetRankCode: row.target_rank_code, approve: true })} type="button">
                                <CircleCheck aria-hidden="true" className="size-3.5" />Approve
                              </button>
                              <button aria-label={`Reject promotion of ${row.employee_name} to ${row.target_rank_code}`} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600" onClick={() => setDeciding({ employeeId: row.employee_id, employeeName: row.employee_name, targetRankCode: row.target_rank_code, approve: false })} type="button">
                                <CircleX aria-hidden="true" className="size-3.5" />Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={5}>{search || status ? "No personnel match these filters." : "No personnel currently meet every requirement for their next rank."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <StaffPager noun="candidates" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />
      </section>

      <StaffSlideOver
        footer={<button className={staffButton.dark} onClick={() => setCriteria(null)} type="button">Close</button>}
        onClose={() => setCriteria(null)}
        open={criteria === "1"}
        size="xl"
        subtitle="Fixed allocations transcribed from the approved promotion parameters, with the requirements the system checks for each next rank."
        title="Official promotion policy matrix"
      >
        <PolicyMatrix />
      </StaffSlideOver>

      {view ? <PromotionDetailsModal employeeId={view} onClose={() => setView(null)} onDecide={setDeciding} /> : null}
      {deciding ? <PromotionDecisionDialog onClose={() => setDeciding(null)} target={deciding} /> : null}
      {recording ? <RecordIperPftDialog onClose={() => setRecording(false)} /> : null}
    </div>
  );
}

/** Read-only reference: the PDF scoring matrices plus the system requirements per target rank. */
function PolicyMatrix() {
  const requirements = usePromotionRankRequirements();
  const ranks = useRankOptions();
  const rankById = new Map((ranks.data ?? []).map((rank) => [rank.id, rank]));
  const rows = (requirements.data ?? [])
    .map((requirement) => ({ requirement, rank: rankById.get(requirement.target_rank_id) }))
    .sort((left, right) => (left.rank?.sort_order ?? 0) - (right.rank?.sort_order ?? 0));

  return (
    <div className="space-y-5">
      {OFFICIAL_PROMOTION_POLICIES.map((policy) => (
        <section className="overflow-hidden rounded-xl border border-slate-200" key={policy.rankBand}>
          <h3 className="bg-slate-900 px-4 py-3 text-sm font-bold text-white">{policy.rankBand}</h3>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold tracking-wide text-slate-500 uppercase"><tr><th className="px-4 py-2" scope="col">Criterion</th><th className="px-4 py-2 text-right" scope="col">Points</th></tr></thead>
            <tbody>
              {policy.criteria.map((criterion) => <tr className="border-t border-slate-100" key={criterion.label}><td className="px-4 py-2"><p className="font-semibold text-slate-800">{criterion.label}</p><p className="text-[10px] text-slate-500">{criterion.detail}</p></td><td className="px-4 py-2 text-right font-mono font-bold text-blue-800">{criterion.points}</td></tr>)}
              {policy.qualifyingRequirements.map((requirement) => <tr className="border-t border-slate-100 bg-amber-50/50" key={requirement.label}><td className="px-4 py-2"><p className="font-semibold text-slate-800">{requirement.label}</p><p className="text-[10px] text-slate-500">{requirement.detail}</p></td><td className="px-4 py-2 text-right text-[10px] font-bold text-amber-700 uppercase">Required</td></tr>)}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td className="px-4 py-2 font-bold text-slate-800">Total</td><td className="px-4 py-2 text-right font-mono font-bold text-slate-900">100</td></tr></tfoot>
          </table>
        </section>
      ))}
      <section aria-labelledby="next-rank-requirements" className="border-t border-slate-200 pt-5">
        <h3 className="text-sm font-bold text-slate-900" id="next-rank-requirements">Requirements checked for each next rank</h3>
        <p className="mt-1 text-xs text-slate-600">Set by the system; HR does not post criteria. Every requirement must be on record for the employee to appear on the dashboard.</p>
        {requirements.isLoading ? <LoadingState label="Loading requirements…" /> : requirements.error ? <ErrorState message={requirements.error.message} /> : (
          <table className="mt-3 w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold tracking-wide text-slate-500 uppercase"><tr><th className="px-3 py-2" scope="col">Target rank</th><th className="px-3 py-2" scope="col">Required training</th><th className="px-3 py-2" scope="col">Other requirements</th></tr></thead>
            <tbody>
              {rows.map(({ requirement, rank }) => (
                <tr className="border-t border-slate-100 align-top" key={requirement.target_rank_id}>
                  <td className="px-3 py-2 font-bold text-slate-800">{rank ? rank.code : `Rank #${requirement.target_rank_id}`}</td>
                  <td className="px-3 py-2 text-slate-700">{requirement.required_training.join(", ") || "None"}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-600">
                    {[
                      `${requirement.min_time_in_grade_months} months in grade`,
                      requirement.requires_eligibility ? "Eligibility with rating" : null,
                      `IPER ${requirement.min_iper} or better (last ${requirement.iper_period_months} months)`,
                      requirement.requires_pft_passed ? `PFT passed (last ${requirement.pft_validity_months} months)` : null,
                    ].filter(Boolean).join(" • ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
