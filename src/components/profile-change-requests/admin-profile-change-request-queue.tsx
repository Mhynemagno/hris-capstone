"use client";
import Link from "next/link";
import { useState } from "react";
import { PaginatedTableControls } from "@/components/administration/paginated-table-controls";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useAdminProfileChangeRequests } from "@/hooks/use-profile-change-requests";
import type { ProfileChangeStatus } from "@/schemas/profile-change-requests";
const statuses: Array<ProfileChangeStatus | ""> = ["", "pending", "approved", "rejected", "cancelled"];
export function AdminProfileChangeRequestQueue() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState<ProfileChangeStatus | "">("pending");
  const result = useAdminProfileChangeRequests({ page, pageSize: 20, ...(status ? { status } : {}) });
  if (result.isLoading) return <LoadingState label="Loading profile-change requests…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  const rows = result.data?.rows ?? [];
  return <div className="space-y-5"><div className="max-w-xs"><label className="block text-sm font-medium" htmlFor="request-status">Status</label><select className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm" id="request-status" onChange={(event) => { setStatus(event.target.value as ProfileChangeStatus | ""); setPage(1); }} value={status}>{statuses.map((item) => <option key={item || "all"} value={item}>{item ? item[0].toUpperCase() + item.slice(1) : "All statuses"}</option>)}</select></div><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Note</th><th className="px-4 py-3"><span className="sr-only">Review</span></th></tr></thead><tbody>{rows.length ? rows.map((request) => <tr className="border-t" key={request.id}><td className="px-4 py-3"><Badge className="capitalize" variant={request.status === "approved" ? "secondary" : request.status === "rejected" ? "destructive" : "outline"}>{request.status}</Badge></td><td className="px-4 py-3 whitespace-nowrap">{new Date(request.created_at).toLocaleString()}</td><td className="max-w-sm truncate px-4 py-3 text-muted-foreground">{request.note || "—"}</td><td className="px-4 py-3 text-right"><Link className="underline" href={`/admin/profile-change-requests/${request.id}`}>Review</Link></td></tr>) : <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>No requests match this status.</td></tr>}</tbody></table></div><PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} /></div>;
}
