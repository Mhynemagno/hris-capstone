"use client";
import Link from "next/link";
import { useState } from "react";
import { PaginatedTableControls } from "@/components/administration/paginated-table-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCancelProfileChangeRequest, useMyProfileChangeRequests } from "@/hooks/use-profile-change-requests";
import type { ProfileChangeRequest } from "@/lib/types/database";

function statusVariant(status: ProfileChangeRequest["status"]) { return status === "approved" ? "secondary" : status === "rejected" ? "destructive" : "outline" as const; }
export function ProfileChangeRequestList() {
  const [page, setPage] = useState(1); const [error, setError] = useState<string | null>(null);
  const requests = useMyProfileChangeRequests({ page, pageSize: 20 }); const cancel = useCancelProfileChangeRequest();
  async function cancelRequest(requestId: string) { setError(null); try { await cancel.mutateAsync({ requestId }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel this request."); } }
  if (requests.isLoading) return <LoadingState label="Loading your profile-change requests…" />;
  if (requests.error) return <ErrorState message={requests.error.message} />;
  const rows = requests.data?.rows ?? [];
  return <section className="space-y-4">{error ? <ErrorState message={error} /> : null}<div className="space-y-3">{rows.length ? rows.map((request) => <article className="rounded-xl border p-4" key={request.id}><div className="flex flex-wrap items-center justify-between gap-3"><Badge className="capitalize" variant={statusVariant(request.status)}>{request.status}</Badge><time className="text-sm text-muted-foreground" dateTime={request.created_at}>Submitted {new Date(request.created_at).toLocaleString()}</time></div>{request.note ? <p className="mt-3 text-sm">{request.note}</p> : null}{request.decision_reason ? <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm"><span className="font-medium">Decision reason:</span> {request.decision_reason}</p> : null}{request.status === "pending" ? <Button className="mt-3" disabled={cancel.isPending} onClick={() => void cancelRequest(request.id)} type="button" variant="outline">{cancel.isPending ? "Cancelling…" : "Cancel request"}</Button> : null}</article>) : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No profile-change requests yet.</p>}</div><PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={requests.data?.count ?? 0} /><Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground" href="/employee/profile/change-request">Request a change</Link></section>;
}
