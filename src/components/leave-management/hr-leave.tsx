"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import { useDecideLeaveRequest, useHrLeaveRequests, useLeaveRequest } from "@/hooks/use-leave-management";
import { formatDate, formatDateRange } from "@/lib/format-date";
import type { LeaveRequestStatus, LeaveRequestWithEmployee } from "@/lib/types/database";
import { getLeaveAttachmentUrl } from "@/queries/leave-management";

import { LeaveStatusBadge } from "./leave-status-badge";
import { LeaveRequestTable } from "./leave-request-table";

const statusOptions: Array<{ value: LeaveRequestStatus; label: string }> = [
  { value: "pending", label: "For Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

/** Full name of the employee who submitted a leave request, e.g. "Juan Dela Cruz". */
function employeeName(request: Pick<LeaveRequestWithEmployee, "employees">) {
  const employee = request.employees;
  if (!employee) return "Unknown employee";
  return [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");
}

export function HrLeaveQueue({ page = 1, onPageChange, onStatusChange, status: controlledStatus }: { page?: number; onPageChange?: (page: number) => void; onStatusChange?: (status: LeaveRequestStatus | "") => void; status?: LeaveRequestStatus | "" } = {}) {
  // The dashboard links here with ?status=pending so the queue opens on For Approval.
  const requested = useSearchParams().get("status");
  const [localStatus, setLocalStatus] = useState<LeaveRequestStatus | "">(
    statusOptions.some((option) => option.value === requested) ? (requested as LeaveRequestStatus) : "",
  );
  const status = controlledStatus ?? localStatus;
  const setStatus = onStatusChange ?? setLocalStatus;
  const result = useHrLeaveRequests({ page, pageSize: 25, status: status || undefined });
  const rows = result.data?.rows ?? [];
  const statusLabel = statusOptions.find((option) => option.value === status)?.label.toLowerCase();

  return (
    <section aria-labelledby="hr-leave-queue-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold" id="hr-leave-queue-heading">
          Leave request queue
        </h2>
        <div className="w-full sm:w-60">
          <FormField htmlFor="leave-status-filter" label="Status">
            <select
              className={nativeSelectClassName}
              id="leave-status-filter"
              onChange={(event) => setStatus(event.target.value as LeaveRequestStatus | "")}
              value={status}
            >
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>
      {result.isLoading ? (
        <LoadingState label="Loading leave requests…" />
      ) : result.error ? (
        <ErrorState message={result.error.message} />
      ) : (
        <><LeaveRequestTable emptyMessage={statusLabel ? `No leave requests are ${statusLabel}. Try another status.` : "No leave requests have been submitted yet."} rows={rows} status={status || undefined} />
        {onPageChange && result.data ? <Pagination from={result.data.rows.length ? (page - 1) * 25 + 1 : 0} noun="leave requests" onPageChange={onPageChange} page={page} pageCount={Math.max(1, Math.ceil(result.data.count / 25))} to={Math.min(page * 25, result.data.count)} total={result.data.count} /> : null}</>
      )}
    </section>
  );
}

function AttachmentButton({ objectPath, fileName }: { objectPath: string; fileName: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setPending(true);
    setError(null);
    try {
      const url = await getLeaveAttachmentUrl(objectPath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open the supporting document.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-1">
      <Button disabled={pending} onClick={() => void open()} size="sm" variant="outline">
        {pending ? "Opening…" : `Open ${fileName}`}
      </Button>
      {error ? <ErrorState message={error} /> : null}
    </div>
  );
}

export function HrLeaveDetail({ requestId }: { requestId: string }) {
  const request = useLeaveRequest(requestId);
  const decide = useDecideLeaveRequest();
  const [note, setNote] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | null>(null);

  if (request.isLoading) return <LoadingState label="Loading leave request…" />;
  if (request.error || !request.data) return <ErrorState message={request.error?.message ?? "Leave request not found."} />;
  const data = request.data;
  const attachments = data.leave_request_attachments ?? [];

  async function submitDecision(decision: "approved" | "rejected") {
    setError(null);
    setSuccess(null);
    setNoteError(undefined);
    if (decision === "rejected" && !note.trim()) {
      setNoteError("Provide a reason when rejecting a leave request.");
      return;
    }
    setPendingDecision(decision);
    try {
      await decide.mutateAsync({ requestId, decision, note });
      setSuccess(decision === "approved" ? "Leave request approved. The employee has been notified." : "Leave request rejected. The employee has been notified.");
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record the decision. Try again.");
    } finally {
      setPendingDecision(null);
    }
  }

  return (
    <section className="max-w-3xl space-y-5">
      <Link className="text-sm font-medium text-primary underline underline-offset-4" href="/hr/leave-requests">
        Back to leave requests
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{data.leave_type_name}</h1>
        <LeaveStatusBadge status={data.status} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="font-semibold text-muted-foreground">Employee</dt>
          <dd>
            {employeeName(data)}
            {data.employees?.employee_number ? <span className="text-muted-foreground"> · Badge no. {data.employees.employee_number}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Dates</dt>
          <dd>{formatDateRange(data.starts_on, data.ends_on)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Submitted</dt>
          <dd>{formatDate(data.created_at)}</dd>
        </div>
        {data.excess_days > 0 ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-muted-foreground">Beyond the yearly limit</dt>
            <dd>{data.excess_days} {data.excess_days === 1 ? "day" : "days"}, deducted from the employee&apos;s retirement benefits</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="font-semibold text-muted-foreground">Notes</dt>
          <dd className="mt-1 rounded-lg bg-muted p-3 whitespace-pre-line">{data.reason || "No notes provided."}</dd>
        </div>
        {data.decision_note ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-muted-foreground">Notes from HR</dt>
            <dd className="mt-1 whitespace-pre-line">{data.decision_note}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="font-semibold text-muted-foreground">Supporting evidence</dt>
          <dd className="mt-1">
            {attachments.length ? (
              <ul className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <AttachmentButton fileName={attachment.file_name} objectPath={attachment.object_path} />
                  </li>
                ))}
              </ul>
            ) : (
              "No documents attached."
            )}
          </dd>
        </div>
      </dl>
      {success ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="status">
          {success}
        </p>
      ) : null}
      {data.status === "pending" ? (
        <div className="space-y-4 rounded-xl border p-4">
          <h2 className="text-lg font-bold" id="decision-notes-heading">
            Notes
          </h2>
          <div className="space-y-2">
            <Textarea
              aria-describedby={noteError ? "decision-note-description decision-note-error" : "decision-note-description"}
              aria-invalid={noteError ? true : undefined}
              aria-label="Notes"
              id="decision-note"
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              value={note}
            />
            <p className="text-sm text-muted-foreground" id="decision-note-description">
              Optional when approving; required when rejecting. The employee can see this note.
            </p>
            {noteError ? (
              <p className="text-sm font-medium text-destructive" id="decision-note-error" role="alert">
                {noteError}
              </p>
            ) : null}
          </div>
          {error ? <ErrorState message={error} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={decide.isPending} onClick={() => void submitDecision("approved")}>
              {pendingDecision === "approved" ? "Approving…" : "Approve request"}
            </Button>
            <Button disabled={decide.isPending} onClick={() => void submitDecision("rejected")} variant="destructive">
              {pendingDecision === "rejected" ? "Rejecting…" : "Reject request"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
