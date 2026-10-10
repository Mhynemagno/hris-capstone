"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import {
  useCancelLeaveRequest,
  useMyLeaveBalances,
  useMyLeaveRequests,
  useRequestableLeaveTypes,
  useSubmitLeaveRequest,
} from "@/hooks/use-leave-management";
import { useEmployeeForCurrentUser } from "@/hooks/use-personnel-records";
import { formatDateRange } from "@/lib/format-date";
import { requestableLeaveTypes } from "@/lib/leave/requestable-types";
import type { LeaveBalance } from "@/lib/types/database";
import { leaveRequestDraftSchema, maxLeaveDate } from "@/schemas/leave-management";

import { LeaveStatusBadge } from "./leave-status-badge";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const dayCount = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/** Inclusive calendar days between two ISO dates, the way submit_leave_request counts them. */
export function leaveDays(startsOn: string, endsOn: string) {
  return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Days still available of a limited leave type, or null when the type has no yearly limit. */
export function remainingLeaveDays(balance: LeaveBalance | undefined) {
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

export function EmployeeLeaveList() {
  const [page, setPage] = useState(1);
  const result = useMyLeaveRequests({ page, pageSize: 10 });
  const cancel = useCancelLeaveRequest();
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (result.isLoading) return <LoadingState label="Loading your leave history…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  const rows = result.data?.rows ?? [];
  const total = result.data?.count ?? 0;

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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Leave history</h2>
        <Link className={buttonVariants()} href="/employee/leave/new">
          Request leave
        </Link>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {rows.length ? (
        rows.map((request) => (
          <article key={request.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-medium">
                {request.leave_type_name} · {formatDateRange(request.starts_on, request.ends_on)}
              </p>
              <LeaveStatusBadge status={request.status} />
            </div>
            {request.excess_days > 0 ? <p className="mt-2 text-sm">{dayCount(request.excess_days)} beyond the yearly limit, deducted from your retirement benefits.</p> : null}
            {request.reason ? <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{request.reason}</p> : null}
            {request.decision_note ? <p className="mt-2 text-sm">Notes from HR: {request.decision_note}</p> : null}
            {request.status === "pending" ? (
              confirmingId === request.id ? (
                <div className="mt-3 space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium" id={`cancel-${request.id}-prompt`}>
                    Cancel this leave request? HR will no longer review it and this cannot be undone.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      aria-describedby={`cancel-${request.id}-prompt`}
                      disabled={cancel.isPending}
                      onClick={() => void cancelRequest(request.id)}
                      variant="destructive"
                    >
                      {cancel.isPending ? "Cancelling…" : "Yes, cancel request"}
                    </Button>
                    <Button disabled={cancel.isPending} onClick={() => setConfirmingId(null)} variant="outline">
                      Keep request
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="mt-3"
                  disabled={cancel.isPending}
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    setConfirmingId(request.id);
                  }}
                  variant="outline"
                >
                  Cancel request
                </Button>
              )
            ) : null}
          </article>
        ))
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          No leave requests yet. Use “Request leave” to submit your first request.
        </p>
      )}
      <Pagination from={rows.length ? (page - 1) * 10 + 1 : 0} noun="leave requests" onPageChange={setPage} page={page} pageCount={Math.max(1, Math.ceil(total / 10))} to={Math.min(page * 10, total)} total={total} />
    </section>
  );
}

type LeaveFieldErrors = Partial<Record<"leaveTypeId" | "startsOn" | "endsOn" | "reason" | "document", string>>;

export function EmployeeLeaveRequestForm() {
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
      setSuccess("Leave request submitted. HR will review it and you will be notified of the decision.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit leave request.");
    }
  }

  return (
    <form className="max-w-3xl space-y-5" noValidate onSubmit={onSubmit}>
      <FormField
        description={activeTypes.length ? balanceHint(balance, year) : "No leave types are available right now. Contact HR."}
        error={fieldErrors.leaveTypeId}
        htmlFor="leave-type"
        label="Leave type"
        required
      >
        <select
          className={nativeSelectClassName}
          id="leave-type"
          name="leaveTypeId"
          onChange={(event) => setLeaveTypeId(event.target.value)}
          required
          value={leaveTypeId}
        >
          <option value="">Choose a type</option>
          {activeTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField error={fieldErrors.startsOn} htmlFor="starts-on" label="Start date" required>
          <Input
            id="starts-on"
            max={maxDate}
            min={minDate}
            name="startsOn"
            onChange={(event) => { setStartsOn(event.target.value); setFieldErrors((current) => ({ ...current, startsOn: leaveDateError(event.target.value, minDate, maxDate) })); }}
            required
            type="date"
            value={startsOn}
          />
        </FormField>
        <FormField error={fieldErrors.endsOn} htmlFor="ends-on" label="End date" required>
          <Input
            id="ends-on"
            max={maxDate}
            min={validStart && validStart > minDate ? validStart : minDate}
            name="endsOn"
            onChange={(event) => { setEndsOn(event.target.value); setFieldErrors((current) => ({ ...current, endsOn: leaveDateError(event.target.value, minDate, maxDate) })); }}
            required
            type="date"
            value={endsOn}
          />
        </FormField>
      </div>
      {selectedType?.requires_attachment ? (
        <FormField description="Required for this leave type, e.g. a medical certificate (PDF or image, up to 10 MB)." error={fieldErrors.document} htmlFor="leave-document" label="Supporting document" required>
          <Input accept="application/pdf,image/png,image/jpeg,image/webp" id="leave-document" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} type="file" />
        </FormField>
      ) : null}
      <FormField error={fieldErrors.reason} htmlFor="leave-notes" label="Notes">
        <Textarea id="leave-notes" maxLength={2000} name="reason" onChange={(event) => setNotes(event.target.value)} rows={4} value={notes} />
      </FormField>
      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="status">
          {success}{" "}
          <Link className="font-medium underline" href="/employee/leave">
            View leave history
          </Link>
        </p>
      ) : null}
      <Button disabled={submit.isPending || !activeTypes.length} type="submit">
        {submit.isPending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
