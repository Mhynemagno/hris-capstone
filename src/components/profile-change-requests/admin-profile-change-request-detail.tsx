"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useDecideProfileChangeRequest, useProfileChangeDocumentUrl, useProfileChangeRequest } from "@/hooks/use-profile-change-requests";
import type { ProfileChangeRequestChange, ProfileChangeRequestDocument, ProfileChangeRequestHistory } from "@/lib/types/database";
import { profileChangeDecisionSchema } from "@/schemas/profile-change-requests";

function humanize(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (value) => value.toUpperCase());
}

function ValueView({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">None</span>;
  if (typeof value === "object" && !Array.isArray(value)) {
    return (
      <dl className="space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]" key={key}>
            <dt className="font-medium text-muted-foreground">{humanize(key)}</dt>
            <dd className="break-words whitespace-pre-line">{item === null || item === "" ? "—" : String(item)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="break-words whitespace-pre-line">{typeof value === "string" ? value : JSON.stringify(value)}</span>;
}

function DocumentLink({ document }: { document: ProfileChangeRequestDocument }) {
  const url = useProfileChangeDocumentUrl(document.object_path);
  if (url.isLoading) return <span className="text-sm text-muted-foreground">Preparing {document.file_name}…</span>;
  if (url.error) return <span className="text-sm text-destructive">{document.file_name}: unavailable ({url.error.message})</span>;
  return (
    <a className="text-sm font-medium text-primary underline underline-offset-4" href={url.data} rel="noreferrer" target="_blank">
      {document.file_name} ({Math.ceil(document.size_bytes / 1024)} KB)
    </a>
  );
}

function ChangeCard({ change }: { change: ProfileChangeRequestChange }) {
  const label = change.kind === "contact" ? humanize(change.field_key ?? "Contact detail") : `Qualification: ${change.operation ?? "change"}`;
  return (
    <li className="rounded-xl border p-4">
      <h3 className="font-semibold capitalize">{label}</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-muted-foreground">Current (when submitted)</dt>
          <dd className="mt-1 rounded-lg bg-muted p-3">
            <ValueView value={change.original_value} />
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Requested</dt>
          <dd className="mt-1 rounded-lg bg-muted p-3">
            <ValueView value={change.requested_value} />
          </dd>
        </div>
      </dl>
    </li>
  );
}

function History({ entries }: { entries: ProfileChangeRequestHistory[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No history recorded.</p>;
  return (
    <ol className="space-y-2">
      {[...entries]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((entry) => (
          <li className="text-sm" key={entry.id}>
            <span className="font-medium capitalize">{entry.event_type}</span>{" "}
            <time className="text-muted-foreground" dateTime={entry.created_at}>
              — {new Date(entry.created_at).toLocaleString()}
            </time>
          </li>
        ))}
    </ol>
  );
}

export function AdminProfileChangeRequestDetail({ requestId }: { requestId: string }) {
  const request = useProfileChangeRequest(requestId);
  const decide = useDecideProfileChangeRequest();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);

  if (request.isLoading) return <LoadingState label="Loading profile-change request…" />;
  if (request.error || !request.data) return <ErrorState message={request.error?.message ?? "Profile-change request not found."} />;
  const data = request.data as {
    status: "pending" | "approved" | "rejected" | "cancelled";
    note: string | null;
    decision_reason: string | null;
    created_at: string;
    profile_change_request_changes: ProfileChangeRequestChange[];
    profile_change_request_documents: ProfileChangeRequestDocument[];
    profile_change_request_history: ProfileChangeRequestHistory[];
  };

  async function decideRequest(decision: "approved" | "rejected") {
    setError(null);
    setReasonError(undefined);
    const parsed = profileChangeDecisionSchema.safeParse({ requestId, decision, reason });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue?.message ?? "Enter a valid decision.";
      if (issue?.path[0] === "reason") setReasonError(message);
      else setError(message);
      return;
    }
    setPendingDecision(decision);
    try {
      await decide.mutateAsync(parsed.data);
      router.push("/admin/profile-change-requests");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record this decision.");
    } finally {
      setPendingDecision(null);
    }
  }

  const changes = [...data.profile_change_request_changes].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <section className="max-w-4xl space-y-6">
      <Link className="text-sm font-medium text-primary underline underline-offset-4" href="/admin/profile-change-requests">
        Back to profile-change requests
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Review request</h2>
          <p className="text-sm text-muted-foreground">Submitted {new Date(data.created_at).toLocaleString()}</p>
        </div>
        <Badge className="capitalize" variant={data.status === "approved" ? "secondary" : data.status === "rejected" ? "destructive" : "outline"}>
          {data.status}
        </Badge>
      </div>
      {data.note ? (
        <section className="space-y-2">
          <h3 className="font-semibold">Employee note</h3>
          <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{data.note}</p>
        </section>
      ) : null}
      <section className="space-y-3">
        <h3 className="font-semibold">Requested changes ({changes.length})</h3>
        <ul className="space-y-3">
          {changes.map((change) => (
            <ChangeCard change={change} key={change.id} />
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Supporting documents</h3>
        {data.profile_change_request_documents.length ? (
          <ul className="space-y-2">
            {data.profile_change_request_documents.map((document) => (
              <li key={document.id}>
                <DocumentLink document={document} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No documents attached.</p>
        )}
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Request history</h3>
        <div className="rounded-xl border p-4">
          <History entries={data.profile_change_request_history} />
        </div>
      </section>
      {data.decision_reason ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          <span className="font-medium">Decision reason:</span> {data.decision_reason}
        </p>
      ) : null}
      {data.status === "pending" ? (
        <section aria-labelledby="decision-heading" className="space-y-4 rounded-xl border p-4">
          <h3 className="font-semibold" id="decision-heading">
            Decision
          </h3>
          <FormField
            description="Required only when rejecting. The employee sees this reason."
            error={reasonError}
            htmlFor="decision-reason"
            label="Rejection reason"
          >
            <Textarea id="decision-reason" maxLength={2000} onChange={(event) => setReason(event.target.value)} value={reason} />
          </FormField>
          {error ? <ErrorState message={error} /> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={decide.isPending} onClick={() => void decideRequest("approved")} type="button">
              {pendingDecision === "approved" ? "Approving…" : "Approve request"}
            </Button>
            <Button disabled={decide.isPending} onClick={() => void decideRequest("rejected")} type="button" variant="destructive">
              {pendingDecision === "rejected" ? "Rejecting…" : "Reject request"}
            </Button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
