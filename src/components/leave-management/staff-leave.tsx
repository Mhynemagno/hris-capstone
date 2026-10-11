"use client";

import { Eye, FileSignature, Layers, Search, SquarePen } from "lucide-react";
import { useState } from "react";

import { InitialsAvatar } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrLeaveRequests, useLeaveTypes } from "@/hooks/use-leave-management";
import { usePanelParam } from "@/hooks/use-panel-param";
import { formatDate, formatDateRange } from "@/lib/format-date";
import { LEAVE_TONE_CLASSES, leaveDateRange, leaveEmployeeName, leaveTypeStyle } from "@/lib/leave-management/leave-type-style";
import { LEAVE_STATUS } from "@/lib/staff/status-maps";
import type { LeaveRequestStatus, LeaveType } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import { LeaveDetailsModal } from "./leave-details-modal";
import { LeavePolicyModal } from "./leave-policy-modal";
import { LeaveReviewModal } from "./leave-review-modal";

const PAGE_SIZE = 10;
const STATUSES: LeaveRequestStatus[] = ["pending", "approved", "rejected", "cancelled"];

function EntitlementCard({ type, onEdit }: { type: LeaveType; onEdit: () => void }) {
  const style = leaveTypeStyle(type.name);
  const footnote = type.description || style.footnote;
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all hover:border-blue-300">
      <div className="flex items-center justify-between">
        <div className={cn("flex size-10 items-center justify-center rounded-xl border", LEAVE_TONE_CLASSES[style.tone])}>
          <style.Icon aria-hidden="true" className="size-4" />
        </div>
        <button aria-label={`Update Policy: ${type.name}`} className="rounded p-1 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={onEdit} title="Update Policy" type="button">
          <SquarePen aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <div>
        <p className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{type.name}</p>
        <p className="text-xl font-black text-slate-900">
          {type.days_per_year === null ? "No limit" : <>{type.days_per_year} Days <span className="text-xs font-normal text-slate-500">/ Year</span></>}
        </p>
      </div>
      {footnote ? <div className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-[10px] font-medium text-slate-500">{footnote}</div> : null}
    </article>
  );
}

/** Leave Management (Capstone UI leave.html, PDF pp. 26–27). Review and details open in place. */
export function StaffLeave() {
  const [review, setReview] = usePanelParam("review");
  const [view, setView] = usePanelParam("view");
  const [statusParam] = usePanelParam("status");
  const [status, setStatus] = useState<LeaveRequestStatus | "">(STATUSES.includes(statusParam as LeaveRequestStatus) ? (statusParam as LeaveRequestStatus) : "");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const types = useLeaveTypes({ pageSize: 100 });
  const requests = useHrLeaveRequests({ page, pageSize: PAGE_SIZE, status: status || undefined });

  const activeTypes = (types.data?.rows ?? []).filter((type) => type.is_active);
  const term = query.trim().toLowerCase();
  const rows = (requests.data?.rows ?? []).filter((row) => !term || leaveEmployeeName(row).toLowerCase().includes(term) || (row.employees?.employee_number ?? "").toLowerCase().includes(term));

  return (
    <div className="space-y-6">
      <PageTitle subtitle="Manage leave entitlement policies and process employee leave applications." title="Leave Management" />

      <section aria-labelledby="entitlements-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900" id="entitlements-heading">
            <Layers aria-hidden="true" className="size-4 text-blue-700" /><span>Annual Leave Entitlements</span>
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">{activeTypes.length} Active Categories</span>
        </div>
        {types.isLoading ? <LoadingState label="Loading leave types…" /> : types.error ? <ErrorState message={types.error.message} /> : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {activeTypes.map((type) => <EntitlementCard key={type.id} onEdit={() => setEditing(type)} type={type} />)}
          </div>
        )}
      </section>

      <section aria-label="Leave Request Queue" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">Leave Request Queue</h2>
            <p className="text-xs text-slate-500">Review pending and processed personnel leave applications</p>
          </div>
          <div className="flex w-full flex-col items-center gap-3 sm:flex-row md:w-auto">
            <div className="relative w-full sm:w-64">
              <input aria-label="Search leave requests" className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-9 text-xs font-medium transition-all focus:ring-2 focus:ring-blue-600 focus:outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Search employee or badge no..." type="search" value={query} />
              <Search aria-hidden="true" className="absolute top-1/2 left-3.5 size-3 -translate-y-1/2 text-slate-500" />
            </div>
            <select aria-label="Leave status" className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none sm:w-44" onChange={(event) => { setStatus(event.target.value as LeaveRequestStatus | ""); setPage(1); }} value={status}>
              <option value="">All Statuses</option>
              {STATUSES.map((value) => <option key={value} value={value}>{LEAVE_STATUS[value].label}</option>)}
            </select>
          </div>
        </div>
        {requests.isLoading ? <LoadingState label="Loading leave requests…" /> : requests.error ? <ErrorState message={requests.error.message} onRetry={() => void requests.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className={staffTable.table}>
              <thead className={staffTable.thead}>
                <tr className="border-b border-slate-100">
                  {["Employee", "Leave Type", "Inclusive Dates", "Submitted", "Status"].map((heading) => <th className={staffTable.th} key={heading} scope="col">{heading}</th>)}
                  <th className={cn(staffTable.th, "text-center")} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {rows.length ? rows.map((row) => {
                  const name = leaveEmployeeName(row);
                  const pending = row.status === "pending";
                  const label = `${name}'s ${row.leave_type_name} leave request, ${formatDateRange(row.starts_on, row.ends_on)}`;
                  return (
                    <tr className={cn(staffTable.tr, pending && "bg-amber-50/20")} key={row.id}>
                      <td className={staffTable.td}>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={name} />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{name}</p>
                            {row.employees?.employee_number ? <p className="font-mono text-[10px] text-slate-500">Badge: {row.employees.employee_number}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className={cn(staffTable.td, "font-bold text-slate-800")}>{row.leave_type_name}</td>
                      <td className={cn(staffTable.td, "font-mono text-[11px] text-slate-600")}>{leaveDateRange(row.starts_on, row.ends_on, formatDate)}</td>
                      <td className={cn(staffTable.td, "text-slate-500")}>{formatDate(row.created_at)}</td>
                      <td className={staffTable.td}><StatusPill tone={LEAVE_STATUS[row.status].tone}>{LEAVE_STATUS[row.status].label}</StatusPill></td>
                      <td className={cn(staffTable.td, "text-center")}>
                        {pending ? (
                          <button aria-label={`Review ${label}`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setReview(row.id)} type="button">
                            <FileSignature aria-hidden="true" className="size-3" /> Review
                          </button>
                        ) : (
                          <button aria-label={`View ${label}`} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setView(row.id)} title="View Details" type="button">
                            <Eye aria-hidden="true" className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }) : <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={6}>No leave requests found matching your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <StaffPager noun="leave requests" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={requests.data?.count ?? 0} />
      </section>

      <LeavePolicyModal onClose={() => setEditing(null)} type={editing} />
      {review ? <LeaveReviewModal onClose={() => setReview(null)} requestId={review} /> : null}
      {view ? <LeaveDetailsModal onClose={() => setView(null)} requestId={view} /> : null}
    </div>
  );
}
