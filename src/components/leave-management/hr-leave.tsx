"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyTableState } from "@/components/ui/empty-table-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDecideLeaveRequest, useHrLeaveRequests, useLeaveRequest } from "@/hooks/use-leave-management";
import type { LeaveRequestStatus } from "@/lib/types/database";
import { getLeaveAttachmentUrl } from "@/queries/leave-management";

import { LeaveStatusBadge } from "./leave-status-badge";

const statusOptions: Array<{ value: LeaveRequestStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export function HrLeaveQueue() {
  const [status, setStatus] = useState<LeaveRequestStatus | "">("");
  const result = useHrLeaveRequests({ page: 1, pageSize: 25, status: status || undefined });
  const rows = result.data?.rows ?? [];
  const statusLabel = statusOptions.find((option) => option.value === status)?.label.toLowerCase();

  return (
    <section aria-labelledby="hr-leave-queue-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold" id="hr-leave-queue-heading">
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
        <div className="relative overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Leave requests{statusLabel ? ` with status ${statusLabel}` : ""}</caption>
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Leave type</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Dates</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Submitted</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Status</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr className="border-t" key={row.id}>
                    <td className="px-4 py-3 align-top font-medium">{row.leave_type_name}</td>
                    <td className="px-4 py-3 align-top">
                      {row.starts_on} to {row.ends_on}
                    </td>
                    <td className="px-4 py-3 align-top">{row.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-3 align-top">
                      <LeaveStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        aria-label={`${row.status === "pending" ? "Review" : "View"} ${row.leave_type_name} request, ${row.starts_on} to ${row.ends_on}`}
                        className="font-medium text-primary underline underline-offset-4"
                        href={`/hr/leave-requests/${row.id}`}
                      >
                        {row.status === "pending" ? "Review" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <EmptyTableState
                    colSpan={5}
                    message={statusLabel ? `No ${statusLabel} leave requests. Try another status.` : "No leave requests have been submitted yet."}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        <h1 className="text-2xl font-semibold">{data.leave_type_name}</h1>
        <LeaveStatusBadge status={data.status} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-muted-foreground">Dates</dt>
          <dd>
            {data.starts_on} to {data.ends_on}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Submitted</dt>
          <dd>{data.created_at.slice(0, 10)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-semibold text-muted-foreground">Reason</dt>
          <dd className="mt-1 rounded-lg bg-muted p-3 whitespace-pre-line">{data.reason}</dd>
        </div>
        {data.decision_note ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold text-muted-foreground">Decision note</dt>
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
          <h2 className="text-lg font-semibold">Decision</h2>
          <FormField
            description="Optional when approving; required when rejecting. The employee can see this note."
            error={noteError}
            htmlFor="decision-note"
            label="Decision note"
          >
            <Textarea id="decision-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={4} value={note} />
          </FormField>
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
