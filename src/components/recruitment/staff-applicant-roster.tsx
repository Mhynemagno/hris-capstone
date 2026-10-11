"use client";

import { Contact, Eye, FileSignature, Search, SlidersHorizontal, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RegisteredApplicantDrawer } from "@/components/recruitment/hr-registered-applicants";
import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { InitialsAvatar } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton, staffIconButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffLabel, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import { useAllHrApplications, useAllHrJobs, useTransitionApplicationStatus } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { APPLICATION_SORT_ACCESSORS, buildApplicationRows, parseApplicationListParams, type ApplicationListRow } from "@/lib/recruitment/application-list";
import { aiMatchLabel, applicationStatusPill } from "@/lib/staff/status-maps";
import type { HrRegisteredApplicant } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useListParams } from "@/lib/workspace/list-params";
import { paginate, sortRows } from "@/lib/workspace/table";
import { applicationStatusSchema } from "@/schemas/recruitment";

const KEYS = ["view", "quick", "stage", "job", "q", "ai", "minScore", "page"] as const;
const PAGE_SIZE = 10;
const AI_LABELS: Record<string, string> = { queued: "Queued", processing: "Analyzing", completed: "Completed", failed: "Failed", unscored: "Not analyzed" };
const filterClassName = "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none";

type ApplicationRow = Extract<ApplicationListRow, { kind: "application" }>;

/** AI scores are stored 0–100; the roster shows them out of 5, as in roster.html. */
function AiMatch({ row }: { row: ApplicationRow }) {
  if (row.aiStatus !== "completed" || row.aiScore === null) return <span className="text-slate-500">{row.aiStatus === "failed" ? "Analysis failed" : AI_LABELS[row.aiStatus] ?? "—"}</span>;
  const outOfFive = Math.round(row.aiScore / 20);
  return (
    <div className="flex flex-col items-center justify-center space-y-1">
      <div className="flex items-center gap-2">
        <div aria-hidden="true" className="h-2 w-24 overflow-hidden rounded-full border border-slate-300 bg-slate-200 p-0.5">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.aiScore}%` }} />
        </div>
        <span className="font-mono text-xs font-black text-emerald-700">{outOfFive} / 5</span>
      </div>
      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 text-[9px] font-bold text-emerald-600">{aiMatchLabel(outOfFive)}</span>
    </div>
  );
}

function statusFilterValue(params: ReturnType<typeof parseApplicationListParams>) {
  if (params.stage) return params.stage;
  if (params.quick === "not-yet-applied") return "pending";
  return "";
}

/** Applicant Roster (Capstone UI roster.html, PDF p. 22). Registered applicants who have not submitted read "Pending". */
export function StaffApplicantRoster() {
  const { params: raw, set } = useListParams(KEYS);
  const params = parseApplicationListParams({ ...raw, quick: raw.quick || "all" });
  const view = raw.view === "applicants" ? "applicants" : "applications";
  const applications = useAllHrApplications({ aiStatus: params.ai || undefined, minimumScore: params.minScore });
  const registered = useHrRegisteredApplicants();
  const jobs = useAllHrJobs();
  const transition = useTransitionApplicationStatus();
  const [drawer, setDrawer] = useState<HrRegisteredApplicant | null>(null);
  const [disqualifying, setDisqualifying] = useState<ApplicationRow | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  const registeredRows: ApplicationListRow[] = (registered.data ?? [])
    .filter((applicant) => !params.q || [applicant.full_name, applicant.email, applicant.first_name, applicant.last_name].some((value) => (value ?? "").toLowerCase().includes(params.q.toLowerCase())))
    .map((applicant) => ({ kind: "registered" as const, id: applicant.user_id, name: [applicant.last_name, applicant.first_name].filter(Boolean).join(", ") || applicant.full_name || applicant.email || "Applicant", applicantNumber: formatApplicantNumber(applicant.applicant_number), submittedAt: applicant.registered_at, applicant }));
  const rows = view === "applicants" ? registeredRows : buildApplicationRows(applications.data ?? [], registered.data ?? [], params);
  const page = paginate(sortRows(rows, params.sort, APPLICATION_SORT_ACCESSORS), params.page, PAGE_SIZE);

  function setStatus(value: string) {
    if (value === "pending") set({ quick: "not-yet-applied", stage: "" });
    else if (value) set({ quick: "", stage: value });
    else set({ quick: "", stage: "" });
  }

  async function disqualify() {
    if (!disqualifying || transition.isPending) return;
    if (!reason.trim()) { setReasonError(true); return; }
    try {
      await transition.mutateAsync({ applicationId: disqualifying.id, nextStatus: "Not Selected", note: reason.trim() });
      notifyStaff({ title: "Applicant disqualified" });
      setDisqualifying(null);
    } catch (error) {
      notifyStaff({ title: "Could not disqualify applicant", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  const loading = applications.isLoading || registered.isLoading;
  const error = applications.error ?? registered.error;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <PageTitle
          actions={(
            <div aria-label="Roster view" className="flex items-center gap-2 rounded-xl bg-slate-200/70 p-1 text-xs font-bold text-slate-600" role="group">
              {([
                { value: "applications", label: "Applications", Icon: FileSignature },
                { value: "applicants", label: "Registered Applicants", Icon: Contact },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  aria-pressed={view === value}
                  className={cn("flex items-center gap-2 rounded-lg px-4 py-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", view === value ? "bg-white text-blue-900 shadow-sm" : "hover:text-slate-900")}
                  key={value}
                  onClick={() => set({ view: value === "applications" ? "" : value })}
                  type="button"
                >
                  <Icon aria-hidden="true" className={cn("size-3.5", view === value ? "text-blue-700" : "text-slate-500")} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
          subtitle="Review and track candidates for recruitment openings."
          title="APPLICANT ROSTER"
        />
      </div>

      <section aria-label="Applicant roster" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="relative lg:col-span-4">
              <input aria-label="Search applicants" className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-9 text-xs font-medium transition-all focus:ring-2 focus:ring-blue-600 focus:outline-none" onChange={(event) => set({ q: event.target.value })} placeholder="Search name or applicant number..." type="search" value={params.q} />
              <Search aria-hidden="true" className="absolute top-1/2 left-3.5 size-3 -translate-y-1/2 text-slate-500" />
            </div>
            <div className="relative lg:col-span-3">
              <select aria-label="Recruitment Openings" className={filterClassName} disabled={view === "applicants"} onChange={(event) => set({ job: event.target.value })} value={params.job ? String(params.job) : ""}>
                <option value="">Recruitment Openings</option>
                {(jobs.data ?? []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
            </div>
            <div className="relative lg:col-span-3">
              <select aria-label="Status" className={filterClassName} disabled={view === "applicants"} onChange={(event) => setStatus(event.target.value)} value={statusFilterValue(params)}>
                <option value="">Status</option>
                <option value="pending">Pending</option>
                {applicationStatusSchema.options.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <Popover>
                <PopoverTrigger render={<button className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" type="button" />}>
                  <SlidersHorizontal aria-hidden="true" className="size-3.5 text-slate-500" /><span>More filters</span>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="capstone-ui w-72 space-y-4 text-xs">
                  <div>
                    <StaffLabel htmlFor="roster-ai-status">AI analysis status</StaffLabel>
                    <select className={filterClassName} id="roster-ai-status" onChange={(event) => set({ ai: event.target.value })} value={params.ai}>
                      <option value="">All results</option>
                      {Object.entries(AI_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <StaffLabel htmlFor="roster-min-score">Minimum AI score (0–100)</StaffLabel>
                    <input className={filterClassName} id="roster-min-score" inputMode="numeric" max={100} min={0} onChange={(event) => set({ minScore: event.target.value })} placeholder="Any score" type="number" value={params.minScore ?? ""} />
                  </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {loading ? <LoadingState label="Loading applicants…" /> : error ? <ErrorState message={error.message} onRetry={() => void applications.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className={staffTable.table}>
              <thead className={staffTable.thead}>
                <tr className="border-b border-slate-100">
                  <th className={staffTable.th} scope="col">Applicant</th>
                  <th className={staffTable.th} scope="col">Recruitment Opening</th>
                  <th className={staffTable.th} scope="col">Status</th>
                  <th className={cn(staffTable.th, "text-center")} scope="col">AI Match Score</th>
                  <th className={staffTable.th} scope="col">Submitted</th>
                  <th className={cn(staffTable.th, "text-center")} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {page.rows.length ? page.rows.map((row) => {
                  const isApplication = row.kind === "application";
                  const pill = isApplication
                    ? applicationStatusPill(row.status)
                    : row.applicant.application_count > 0 ? { label: "Applied", tone: "blue" as const } : applicationStatusPill("Pending");
                  return (
                    <tr className={staffTable.tr} key={`${row.kind}-${row.id}`}>
                      <td className={staffTable.td}>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={row.name} size="lg" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{row.name}</p>
                            <p className="font-mono text-[11px] text-slate-500">ID: {row.applicantNumber ?? "Pending"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={staffTable.td}>{isApplication ? <p className="font-bold text-slate-800">{row.jobTitle ?? "—"}</p> : <span className="text-slate-500">—</span>}</td>
                      <td className={staffTable.td}><StatusPill tone={pill.tone}>{pill.label}</StatusPill></td>
                      <td className={cn(staffTable.td, "text-center")}>{isApplication ? <AiMatch row={row} /> : <span className="text-slate-500">—</span>}</td>
                      <td className={staffTable.td}><p className="font-semibold text-slate-800">{formatDate(row.submittedAt)}</p></td>
                      <td className={staffTable.td}>
                        <div className="flex items-center justify-center gap-1.5">
                          {isApplication ? (
                            <>
                              <Link aria-label="View Profile" className={cn(staffIconButton, "hover:bg-blue-50 hover:text-blue-600")} href={`/hr/applications/${row.id}`} title="View Profile"><Eye aria-hidden="true" className="size-3.5" /></Link>
                              <Link aria-label="Edit Candidate" className={cn(staffIconButton, "hover:bg-amber-50 hover:text-amber-600")} href={`/hr/applications/${row.id}#stage-actions`} title="Edit Candidate"><SquarePen aria-hidden="true" className="size-3.5" /></Link>
                              {row.status !== "Hired" && row.status !== "Not Selected" ? (
                                <button aria-label="Delete Candidate" className={cn(staffIconButton, "hover:bg-rose-50 hover:text-rose-600")} onClick={() => { setDisqualifying(row); setReason(""); setReasonError(false); }} title="Delete Candidate" type="button"><Trash2 aria-hidden="true" className="size-3.5" /></button>
                              ) : null}
                            </>
                          ) : (
                            <button aria-label="View Profile" className={cn(staffIconButton, "hover:bg-blue-50 hover:text-blue-600")} onClick={() => setDrawer(row.applicant)} title="View Profile" type="button"><Eye aria-hidden="true" className="size-3.5" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={6}>No applicants match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <StaffPager noun={view === "applicants" ? "registered applicants" : "applications"} onPageChange={(next) => set({ page: String(next) })} page={page.page} pageSize={PAGE_SIZE} total={page.total} />
      </section>

      <StaffModal
        footer={(
          <>
            <button className={staffButton.secondary} onClick={() => setDisqualifying(null)} type="button">Cancel</button>
            <button className={staffButton.danger} disabled={transition.isPending} onClick={() => void disqualify()} type="button">Disqualify</button>
          </>
        )}
        icon={<Trash2 aria-hidden="true" className="size-4" />}
        iconClassName="bg-rose-100 text-rose-700"
        onClose={() => setDisqualifying(null)}
        open={disqualifying !== null}
        subtitle="The application moves to Not Selected. This cannot be undone from the roster."
        title="Disqualify or remove applicant?"
      >
        <p className="font-semibold text-slate-800">{disqualifying?.name}</p>
        <div>
          <StaffLabel htmlFor="disqualify-reason" required>Reason</StaffLabel>
          <StaffTextarea aria-invalid={reasonError} id="disqualify-reason" onChange={(event) => { setReason(event.target.value); setReasonError(false); }} rows={3} value={reason} />
          {reasonError ? <p className="mt-1 text-[10px] font-bold text-rose-500">Enter a reason.</p> : null}
        </div>
      </StaffModal>
      <RegisteredApplicantDrawer applicant={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
