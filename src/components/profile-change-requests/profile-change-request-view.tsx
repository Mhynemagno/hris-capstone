"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useProfileChangeRequest } from "@/hooks/use-profile-change-requests";
import { formatDateTime } from "@/lib/format-date";
import type { ProfileChangeRequest, ProfileChangeRequestChange, ProfileChangeRequestDocument } from "@/lib/types/database";

import { ChangeCard, DocumentLink } from "./admin-profile-change-request-detail";

type RequestDetail = ProfileChangeRequest & { profile_change_request_changes: ProfileChangeRequestChange[]; profile_change_request_documents: ProfileChangeRequestDocument[] };

const decisionText: Record<ProfileChangeRequest["status"], string> = { pending: "Waiting for review.", approved: "Approved. Your profile now shows these changes.", rejected: "Rejected. Your profile was not changed.", cancelled: "You cancelled this request." };

export function statusVariant(status: ProfileChangeRequest["status"]) {
  return status === "approved" ? "secondary" : status === "rejected" ? "destructive" : ("outline" as const);
}

/** The employee's read-only view of one of their profile-change requests: what they asked to change and the reviewer's decision. */
export function ProfileChangeRequestView({ requestId }: { requestId: string }) {
  const request = useProfileChangeRequest(requestId);
  if (request.isLoading) return <LoadingState label="Loading profile-change request…" />;
  if (request.error || !request.data) return <ErrorState message={request.error?.message ?? "Profile-change request not found."} />;
  const data = request.data as RequestDetail;
  const changes = [...(data.profile_change_request_changes ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const documents = data.profile_change_request_documents ?? [];

  return <section className="max-w-4xl space-y-6">
    <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline" href="/employee/profile/change-requests"><ArrowLeft aria-hidden className="size-4" />Back to my requests</Link>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-semibold tracking-tight">Profile change request</h1><p className="text-sm text-muted-foreground">Submitted {formatDateTime(data.created_at)}</p></div>
      <Badge className="capitalize" variant={statusVariant(data.status)}>{data.status}</Badge>
    </div>
    <section aria-labelledby="request-decision" className="space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold" id="request-decision">Decision</h2>
      <p className="text-sm">{decisionText[data.status]}{data.decided_at && data.status !== "cancelled" ? <span className="text-muted-foreground"> {formatDateTime(data.decided_at)}</span> : null}</p>
      {data.decision_reason ? <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-line"><span className="font-medium">Reviewer note:</span> {data.decision_reason}</p> : null}
    </section>
    {data.note ? <section className="space-y-2"><h2 className="font-semibold">Your note</h2><p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{data.note}</p></section> : null}
    <section className="space-y-3">
      <h2 className="font-semibold">Requested changes ({changes.length})</h2>
      <ul className="space-y-3">{changes.map((change) => <ChangeCard change={change} key={change.id} originalLabel="Previous value" />)}</ul>
    </section>
    {documents.length ? <section className="space-y-3"><h2 className="font-semibold">Supporting documents</h2><ul className="space-y-2">{documents.map((document) => <li key={document.id}><DocumentLink document={document} /></li>)}</ul></section> : null}
  </section>;
}
