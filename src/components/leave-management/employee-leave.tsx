"use client";

import { Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import { StaffInput, StaffLabel, StaffSelect, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  useCancelLeaveRequest,
  useMyLeaveBalances,
  useMyLeaveRequests,
  useRequestableLeaveTypes,
  useSubmitLeaveRequest,
} from "@/hooks/use-leave-management";
import { useEmployeeForCurrentUser } from "@/hooks/use-personnel-records";
import { formatDate, formatDateRange } from "@/lib/format-date";
import { LEAVE_TONE_CLASSES, leaveDateRange, leaveTypeStyle, type LeaveTone } from "@/lib/leave-management/leave-type-style";
import { requestableLeaveTypes } from "@/lib/leave/requestable-types";
import { LEAVE_STATUS } from "@/lib/staff/status-maps";
import type { LeaveBalance } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { leaveRequestDraftSchema, maxLeaveDate } from "@/schemas/leave-management";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const dayCount = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/** Inclusive calendar days between two ISO dates, the way submit_leave_request counts them. */
export function leaveDays(startsOn: string, endsOn: string) {
  return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Days still available of a limited leave type, or null when the type has no yearly limit. */
export function remainingLeaveDays(balance: Pick<LeaveBalance, "days_per_year" | "used_days"> | undefined) {
  if (!balance || balance.days_per_year === null) return null;
  return Math.max(balance.days_per_year - balance.used_days, 0);
}

/** Inline message for a typed leave date outside today … two years ahead, or a partial value. */
export function leaveDateError(value: string, min: string, max: string) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < min) return "Choose today or a future date.";
  if (value > max) return "Choose a date within the next two years.";
  return undefined;
}

function balanceHint(balance: LeaveBalance | undefined, year: number) {
  const remaining = remainingLeaveDays(balance);
  if (!balance || remaining === null || balance.days_per_year === null) return undefined;
  const left = `${dayCount(remaining)} of ${balance.days_per_year} left for ${year}.`;
  return balance.excess_deducted_from_retirement ? `${left} Days beyond this are allowed but deducted from your retirement benefits.` : left;
}

type HistoryTab = "all" | "pending" | "approved" | "rejected";
const HISTORY_TABS: { value: HistoryTab; label: string }[] = [
  { value: "all", label: "All Requests" },
  { value: "pending", label: "For Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];
const EMPTY_HISTORY: Record<HistoryTab, string> = {
  all: "No leave requests yet. Use “Request New Leave” to file your first request.",
  pending: "No leave requests are waiting for approval.",
  approved: "No approved leave requests yet.",
  rejected: "No rejected leave requests yet.",
};
const PAGE_SIZE = 10;
/** Below md each table row becomes a card: the cell label comes from data-label. */
const cardLabel = "max-md:before:shrink-0 max-md:before:text-left max-md:before:text-[10px] max-md:before:font-bold max-md:before:tracking-wider max-md:before:text-slate-500 max-md:before:uppercase max-md:before:content-[attr(data-label)]";
const cardCell = `max-md:flex max-md:items-start max-md:justify-between max-md:gap-3 max-md:px-1 max-md:py-1.5 max-md:text-right ${cardLabel}`;
/** Multi-line cells (reason and HR feedback): the label sits above a left-aligned column of paragraphs. */
const cardStack = `max-md:flex max-md:flex-col max-md:gap-1 max-md:px-1 max-md:py-1.5 max-md:text-left ${cardLabel}`;
const HEADINGS = ["Leave Category", "Inclusive Dates", "Duration", "Reason / HR Feedback", "Approval Status", "Actions"];

/** Leave Application History: tabs, a table with word-form dates, HR feedback, status pills and the cancel flow. */
export function EmployeeLeaveList() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<HistoryTab>("all");
  const result = useMyLeaveRequests({ page, pageSize: PAGE_SIZE, status: tab === "all" ? undefined : tab });
  const cancel = useCancelLeaveRequest();
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rows = result.data?.rows ?? [];
  const total = result.data?.count ?? 0;

  function selectTab(next: HistoryTab) {
    setTab(next);
    setPage(1);
    setConfirmingId(null);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = HISTORY_TABS[(index + step + HISTORY_TABS.length) % HISTORY_TABS.length];
    selectTab(next.value);
    document.getElementById(`leave-tab-${next.value}`)?.focus();
  }

  async function cancelRequest(requestId: string) {
    setError(null);
    setMessage(null);
    try {
      await cancel.mutateAsync({ requestId });
      setConfirmingId(null);
      setMessage("Leave request cancelled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to cancel this request.");
    }
  }

  return (
    <section aria-labelledby="leave-history-heading" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-bold text-slate-900" id="leave-history-heading">Leave Application History</h2>
          <p className="text-xs text-slate-500">Review status, details, and feedback from San Juan CPS HR</p>
        </div>
        <div aria-label="Filter leave requests" className="flex items-center self-start rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600 sm:self-auto" role="tablist">
          {HISTORY_TABS.map((item, index) => (
            <button
              aria-controls="leave-history-panel"
              aria-selected={tab === item.value}
              className={cn("rounded-lg px-3 py-1.5 transition-all focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none", tab === item.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}
              id={`leave-tab-${item.value}`}
              key={item.value}
              onClick={() => selectTab(item.value)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              role="tab"
              tabIndex={tab === item.value ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {error ? <div className="p-4"><ErrorState message={error} /></div> : null}
      {message ? <p className="px-5 pt-4 text-xs font-medium text-slate-600" role="status">{message}</p> : null}
      <div aria-labelledby={`leave-tab-${tab}`} id="leave-history-panel" role="tabpanel">
        {result.isLoading ? <LoadingState label="Loading your leave history…" /> : result.error ? <ErrorState message={result.error.message} onRetry={() => void result.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className={cn(staffTable.table, "max-md:block max-md:min-w-0")}>
              <thead className={cn(staffTable.thead, "max-md:sr-only")}>
                <tr className="border-b border-slate-100">
                  {HEADINGS.map((heading) => <th className={cn(staffTable.th, heading === "Actions" && "text-right")} key={heading} scope="col">{heading}</th>)}
                </tr>
              </thead>
              <tbody className={cn(staffTable.tbody, "max-md:block max-md:space-y-3 max-md:divide-y-0 max-md:p-3")}>
                {rows.length ? rows.map((request) => {
                  const style = leaveTypeStyle(request.leave_type_name);
                  const confirming = confirmingId === request.id;
                  const hasRemarks = Boolean(request.reason || request.decision_note || request.excess_days > 0);
                  return (
                    <Fragment key={request.id}>
                      <tr className={cn(staffTable.tr, "max-md:block max-md:rounded-xl max-md:border max-md:border-slate-200 max-md:p-3")}>
                        <td className={cn(staffTable.td, cardCell)} data-label="Leave Category">
                          <div className="flex items-center gap-3">
                            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", LEAVE_TONE_CLASSES[style.tone])}><style.Icon aria-hidden="true" className="size-3.5" /></span>
                            <span className="font-bold text-slate-900">{request.leave_type_name}</span>
                          </div>
                        </td>
                        <td className={cn(staffTable.td, cardCell, "text-slate-600")} data-label="Inclusive Dates">{leaveDateRange(request.starts_on, request.ends_on, formatDate)}</td>
                        <td className={cn(staffTable.td, cardCell, "tabular-nums")} data-label="Duration">{dayCount(leaveDays(request.starts_on, request.ends_on))}</td>
                        <td className={cn(staffTable.td, cardStack, "max-w-xs space-y-1 max-md:max-w-none")} data-label="Reason / HR Feedback">
                          {request.reason ? <p className="whitespace-pre-line text-slate-600">{request.reason}</p> : null}
                          {request.decision_note ? <p className="font-semibold text-slate-800">Notes from HR: {request.decision_note}</p> : null}
                          {request.excess_days > 0 ? <p className="text-amber-700">{dayCount(request.excess_days)} beyond the yearly limit, deducted from your retirement benefits.</p> : null}
                          {hasRemarks ? null : <p className="text-slate-500">No remarks</p>}
                        </td>
                        <td className={cn(staffTable.td, cardCell)} data-label="Approval Status"><StatusPill tone={LEAVE_STATUS[request.status].tone}>{LEAVE_STATUS[request.status].label}</StatusPill></td>
                        <td className={cn(staffTable.td, cardCell, "text-right")} data-label="Actions">
                          {request.status === "pending" && !confirming ? (
                            <button
                              aria-label={`Cancel request: ${request.leave_type_name}, ${formatDateRange(request.starts_on, request.ends_on)}`}
                              className={cn(staffButton.danger, "px-3 py-1.5 text-[11px]")}
                              disabled={cancel.isPending}
                              onClick={() => { setError(null); setMessage(null); setConfirmingId(request.id); }}
                              type="button"
                            >
                              Cancel request
                            </button>
                          ) : <span className="text-slate-500">—</span>}
                        </td>
                      </tr>
                      {confirming ? (
                        <tr className="bg-rose-50/40 max-md:block max-md:rounded-xl">
                          <td className="px-6 py-4 max-md:block" colSpan={HEADINGS.length}>
                            <p className="text-xs font-semibold text-slate-800" id={`cancel-${request.id}-prompt`}>Cancel this leave request? HR will no longer review it and this cannot be undone.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button aria-describedby={`cancel-${request.id}-prompt`} className={staffButton.danger} disabled={cancel.isPending} onClick={() => void cancelRequest(request.id)} type="button">{cancel.isPending ? "Cancelling…" : "Yes, cancel request"}</button>
                              <button className={staffButton.secondary} disabled={cancel.isPending} onClick={() => setConfirmingId(null)} type="button">Keep request</button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                }) : <tr className="max-md:block"><td className="px-6 py-10 text-center text-xs text-slate-500 max-md:block" colSpan={HEADINGS.length}>{EMPTY_HISTORY[tab]}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {result.isLoading || result.error ? null : <StaffPager noun="leave requests" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />}
    </section>
  );
}

const BAR_CLASSES: Record<LeaveTone, string> = { blue: "bg-blue-500", purple: "bg-purple-500", emerald: "bg-emerald-500", rose: "bg-rose-500", amber: "bg-amber-500", slate: "bg-slate-500" };

/** The leave types the employee can take, as cards with days left this year; a bar only for a finite yearly limit. */
export function EmployeeLeaveCredits() {
  const types = useRequestableLeaveTypes();
  const employee = useEmployeeForCurrentUser();
  const year = Number(today().slice(0, 4));
  const balances = useMyLeaveBalances(year);
  if (types.isLoading || employee.isLoading || balances.isLoading) return <LoadingState label="Loading leave credits…" />;
  const loadError = types.error ?? employee.error ?? balances.error;
  if (loadError) return <ErrorState message={loadError.message} />;
  const available = requestableLeaveTypes(types.data ?? [], employee.data?.gender);
  return (
    <section aria-labelledby="my-leave-credits" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase" id="my-leave-credits">Leave Credit Entitlements</h2>
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500"><Info aria-hidden="true" className="size-3 text-blue-600" />Standard PNP HR Leave Allocations</span>
      </div>
      {available.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {available.map((type) => {
            const style = leaveTypeStyle(type.name);
            const limit = type.days_per_year;
            const balance = balances.data?.find((entry) => entry.leave_type_id === type.id);
            const remaining = remainingLeaveDays({ days_per_year: limit, used_days: balance?.used_days ?? 0 });
            const percent = limit && remaining !== null ? Math.round((remaining / limit) * 100) : 0;
            const headingId = `leave-credit-${type.id}`;
            const note = type.description || style.footnote;
            return (
              <li key={type.id}>
                <article aria-labelledby={headingId} className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={cn("flex size-10 items-center justify-center rounded-xl border", LEAVE_TONE_CLASSES[style.tone])}><style.Icon aria-hidden="true" className="size-4" /></span>
                      {type.requires_attachment ? <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Document required</span> : null}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase" id={headingId}>{type.name}</h3>
                      {limit === null ? (
                        <p className="mt-1 text-xl font-black text-slate-900">No yearly limit</p>
                      ) : (
                        <p className="mt-1 flex items-baseline gap-1.5"><span className="font-mono text-2xl font-black text-slate-900">{remaining}</span><span className="text-xs font-semibold text-slate-500">/ {limit} Days Left in {year}</span></p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                    {limit !== null ? (
                      <div aria-label={`${type.name} days left`} aria-valuemax={limit} aria-valuemin={0} aria-valuenow={remaining ?? 0} className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar">
                        <div className={cn("h-full rounded-full", BAR_CLASSES[style.tone])} style={{ width: `${percent}%` }} />
                      </div>
                    ) : null}
                    {note ? <p className="text-[10px] text-slate-500">{note}</p> : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500" role="status">No leave types are available right now. Contact HR.</p>}
    </section>
  );
}

/** A Capstone modal field: label, control, optional hint and an inline error tied to the control. */
function Field({ children, description, error, htmlFor, label, required }: { children: (aria: { "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode; description?: string; error?: string; htmlFor: string; label: string; required?: boolean }) {
  const describedBy = [description ? `${htmlFor}-description` : null, error ? `${htmlFor}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <StaffLabel className="font-bold" htmlFor={htmlFor} required={required}>{label}</StaffLabel>
      {children({ "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) })}
      {description ? <p className="mt-1 text-[11px] text-slate-500" id={`${htmlFor}-description`}>{description}</p> : null}
      {error ? <p className="mt-1 text-[11px] font-semibold text-rose-700" id={`${htmlFor}-error`} role="alert">{error}</p> : null}
    </div>
  );
}

type LeaveFieldErrors = Partial<Record<"leaveTypeId" | "startsOn" | "endsOn" | "reason" | "document", string>>;

/**
 * The leave request form. Inside the File Leave Application modal, `onSubmitted` receives the success message
 * and `onCancel` adds a Cancel button; on its own the form shows the message itself.
 */
export function EmployeeLeaveRequestForm({ onCancel, onSubmitted }: { onCancel?: () => void; onSubmitted?: (message: string) => void } = {}) {
  const types = useRequestableLeaveTypes();
  const employee = useEmployeeForCurrentUser();
  const submit = useSubmitLeaveRequest();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [notes, setNotes] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LeaveFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const minDate = today();
  const maxDate = maxLeaveDate();
  // Only a complete, in-range start date picks the balance year, so a half-typed year never queries year 1.
  const validStart = startsOn && !leaveDateError(startsOn, minDate, maxDate) ? startsOn : null;
  const year = Number((validStart ?? minDate).slice(0, 4));
  const balances = useMyLeaveBalances(year);
  const balance = balances.data?.find((entry) => entry.leave_type_id === leaveTypeId);

  if (types.isLoading || employee.isLoading) return <LoadingState label="Loading leave types…" />;
  const loadError = types.error ?? employee.error;
  if (loadError) return <ErrorState message={loadError.message} />;
  const activeTypes = requestableLeaveTypes(types.data ?? [], employee.data?.gender);
  const selectedType = activeTypes.find((type) => type.id === leaveTypeId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const draft = { leaveTypeId, startsOn, endsOn, reason: notes };
    const nextErrors: LeaveFieldErrors = {};
    const parsed = leaveRequestDraftSchema.safeParse(draft);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof LeaveFieldErrors;
        if (key && !nextErrors[key]) nextErrors[key] = key === "leaveTypeId" ? "Choose a leave type." : issue.message;
      }
    }
    const remaining = remainingLeaveDays(balance);
    if (parsed.success && remaining !== null && !balance?.excess_deducted_from_retirement && leaveDays(startsOn, endsOn) > remaining) {
      nextErrors.endsOn = remaining === 0 ? `You have already used all your days of this leave for ${year}.` : `You have ${dayCount(remaining)} of this leave left for ${year}. Shorten the request to fit.`;
    }
    if (selectedType?.requires_attachment && !document) nextErrors.document = "Attach a supporting document, such as a medical certificate.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await submit.mutateAsync({ draft: { requestId: crypto.randomUUID(), ...draft }, files: document ? [document] : [] });
      setLeaveTypeId("");
      setStartsOn("");
      setEndsOn("");
      setNotes("");
      setDocument(null);
      const done = "Leave request submitted. HR will review it and you will be notified of the decision.";
      if (onSubmitted) onSubmitted(done);
      else setSuccess(done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit leave request.");
    }
  }

  return (
    <form className={onCancel ? "space-y-4" : "max-w-3xl space-y-4"} noValidate onSubmit={onSubmit}>
      <Field description={activeTypes.length ? balanceHint(balance, year) : "No leave types are available right now. Contact HR."} error={fieldErrors.leaveTypeId} htmlFor="leave-type" label="Leave type" required>
        {(aria) => (
          <StaffSelect {...aria} id="leave-type" name="leaveTypeId" onChange={(event) => setLeaveTypeId(event.target.value)} required value={leaveTypeId}>
            <option value="">Select category...</option>
            {activeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}{typeof type.days_per_year === "number" ? ` (${type.days_per_year} Days/Yr)` : ""}</option>)}
          </StaffSelect>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={fieldErrors.startsOn} htmlFor="starts-on" label="Start date" required>
          {(aria) => (
            <StaffInput
              {...aria}
              id="starts-on"
              max={maxDate}
              min={minDate}
              name="startsOn"
              onChange={(event) => { setStartsOn(event.target.value); setFieldErrors((current) => ({ ...current, startsOn: leaveDateError(event.target.value, minDate, maxDate) })); }}
              required
              type="date"
              value={startsOn}
            />
          )}
        </Field>
        <Field error={fieldErrors.endsOn} htmlFor="ends-on" label="End date" required>
          {(aria) => (
            <StaffInput
              {...aria}
              id="ends-on"
              max={maxDate}
              min={validStart && validStart > minDate ? validStart : minDate}
              name="endsOn"
              onChange={(event) => { setEndsOn(event.target.value); setFieldErrors((current) => ({ ...current, endsOn: leaveDateError(event.target.value, minDate, maxDate) })); }}
              required
              type="date"
              value={endsOn}
            />
          )}
        </Field>
      </div>
      {selectedType?.requires_attachment ? (
        <Field description="Required for this leave type, e.g. a medical certificate (PDF or image, up to 10 MB)." error={fieldErrors.document} htmlFor="leave-document" label="Supporting document" required>
          {(aria) => <StaffInput {...aria} accept="application/pdf,image/png,image/jpeg,image/webp" id="leave-document" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} type="file" />}
        </Field>
      ) : null}
      <Field error={fieldErrors.reason} htmlFor="leave-notes" label="Notes">
        {(aria) => <StaffTextarea {...aria} className="resize-none" id="leave-notes" maxLength={2000} name="reason" placeholder="Provide reason for leave application..." onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />}
      </Field>
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
        <span>Applications require Station Commander / HR endorsement before deployment schedule adjustment.</span>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800" role="status">
          {success}{" "}
          <Link className="font-bold underline" href="/employee/leave">View leave history</Link>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {onCancel ? <button className={staffButton.secondary} disabled={submit.isPending} onClick={onCancel} type="button">Cancel</button> : null}
        <button className={staffButton.primary} disabled={submit.isPending || !activeTypes.length} type="submit">{submit.isPending ? "Submitting…" : "Submit Application"}</button>
      </div>
    </form>
  );
}
