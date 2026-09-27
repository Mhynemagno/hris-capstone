"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCancelLeaveRequest,
  useMyLeaveRequests,
  useRequestableLeaveTypes,
  useSubmitLeaveRequest,
} from "@/hooks/use-leave-management";
import { leaveRequestDraftSchema } from "@/schemas/leave-management";

import { LeaveStatusBadge } from "./leave-status-badge";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function EmployeeLeaveList() {
  const result = useMyLeaveRequests({ page: 1, pageSize: 25 });
  const cancel = useCancelLeaveRequest();
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (result.isLoading) return <LoadingState label="Loading your leave history…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  const rows = result.data?.rows ?? [];

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
        <h2 className="text-xl font-semibold">Leave history</h2>
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
                {request.leave_type_name} · {request.starts_on} to {request.ends_on}
              </p>
              <LeaveStatusBadge status={request.status} />
            </div>
            {request.reason ? <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{request.reason}</p> : null}
            {request.decision_note ? <p className="mt-2 text-sm">Decision note: {request.decision_note}</p> : null}
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
    </section>
  );
}

type LeaveFieldErrors = Partial<Record<"leaveTypeId" | "startsOn" | "endsOn" | "reason", string>>;

export function EmployeeLeaveRequestForm() {
  const types = useRequestableLeaveTypes();
  const submit = useSubmitLeaveRequest();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LeaveFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (types.isLoading) return <LoadingState label="Loading leave types…" />;
  if (types.error) return <ErrorState message={types.error.message} />;
  const activeTypes = (types.data ?? []).filter((type) => type.is_active);
  const minDate = today();

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
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await submit.mutateAsync({ draft: { requestId: crypto.randomUUID(), ...draft }, files: [] });
      setLeaveTypeId("");
      setStartsOn("");
      setEndsOn("");
      setNotes("");
      setSuccess("Leave request submitted. HR will review it and you will be notified of the decision.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit leave request.");
    }
  }

  return (
    <form className="max-w-3xl space-y-5" noValidate onSubmit={onSubmit}>
      <FormField
        description={activeTypes.length ? undefined : "No leave types are available right now. Contact HR."}
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
            min={minDate}
            name="startsOn"
            onChange={(event) => setStartsOn(event.target.value)}
            required
            type="date"
            value={startsOn}
          />
        </FormField>
        <FormField error={fieldErrors.endsOn} htmlFor="ends-on" label="End date" required>
          <Input
            id="ends-on"
            min={startsOn && startsOn > minDate ? startsOn : minDate}
            name="endsOn"
            onChange={(event) => setEndsOn(event.target.value)}
            required
            type="date"
            value={endsOn}
          />
        </FormField>
      </div>
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
