"use client";

import Link from "next/link";
import { useState } from "react";

import { PaginatedTableControls } from "@/components/administration/paginated-table-controls";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCancelProfileChangeRequest, useMyProfileChangeRequests } from "@/hooks/use-profile-change-requests";
import type { ProfileChangeRequest } from "@/lib/types/database";

function statusVariant(status: ProfileChangeRequest["status"]) {
  return status === "approved" ? "secondary" : status === "rejected" ? "destructive" : ("outline" as const);
}

export function ProfileChangeRequestList() {
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const requests = useMyProfileChangeRequests({ page, pageSize: 20 });
  const cancel = useCancelProfileChangeRequest();

  async function cancelRequest(requestId: string) {
    setError(null);
    setMessage(null);
    try {
      await cancel.mutateAsync({ requestId });
      setConfirmingId(null);
      setMessage("Profile-change request cancelled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to cancel this request.");
    }
  }

  if (requests.isLoading) return <LoadingState label="Loading your profile-change requests…" />;
  if (requests.error) return <ErrorState message={requests.error.message} />;
  const rows = requests.data?.rows ?? [];

  return (
    <section className="space-y-4">
      {error ? <ErrorState message={error} /> : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      <div className="space-y-3">
        {rows.length ? (
          rows.map((request) => (
            <article className="rounded-xl border p-4" key={request.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge className="capitalize" variant={statusVariant(request.status)}>
                  {request.status}
                </Badge>
                <time className="text-sm text-muted-foreground" dateTime={request.created_at}>
                  Submitted {new Date(request.created_at).toLocaleString()}
                </time>
              </div>
              {request.note ? <p className="mt-3 text-sm whitespace-pre-line">{request.note}</p> : null}
              {request.decision_reason ? (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">Decision reason:</span> {request.decision_reason}
                </p>
              ) : null}
              {request.status === "pending" ? (
                confirmingId === request.id ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-medium" id={`cancel-${request.id}-prompt`}>
                      Cancel this request? The administrator will no longer review it and this cannot be undone.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        aria-describedby={`cancel-${request.id}-prompt`}
                        disabled={cancel.isPending}
                        onClick={() => void cancelRequest(request.id)}
                        type="button"
                        variant="destructive"
                      >
                        {cancel.isPending ? "Cancelling…" : "Yes, cancel request"}
                      </Button>
                      <Button disabled={cancel.isPending} onClick={() => setConfirmingId(null)} type="button" variant="outline">
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
                    type="button"
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
            No profile-change requests yet. Use “Request a change” to propose updates to your contact details or qualifications.
          </p>
        )}
      </div>
      <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={requests.data?.count ?? 0} />
      <Link className={buttonVariants()} href="/employee/profile/change-request">
        Request a change
      </Link>
    </section>
  );
}
