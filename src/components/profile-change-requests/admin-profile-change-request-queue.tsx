"use client";

import Link from "next/link";
import { useState } from "react";

import { PaginatedTableControls } from "@/components/administration/paginated-table-controls";
import { Badge } from "@/components/ui/badge";
import { EmptyTableState } from "@/components/ui/empty-table-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { useAdminProfileChangeRequests } from "@/hooks/use-profile-change-requests";
import type { ProfileChangeStatus } from "@/schemas/profile-change-requests";

const statuses: Array<ProfileChangeStatus | ""> = ["", "pending", "approved", "rejected", "cancelled"];
const statusLabel = (status: ProfileChangeStatus | "") => (status ? status[0].toUpperCase() + status.slice(1) : "All statuses");

export function AdminProfileChangeRequestQueue() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProfileChangeStatus | "">("pending");
  const result = useAdminProfileChangeRequests({ page, pageSize: 20, ...(status ? { status } : {}) });
  const rows = result.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <FormField htmlFor="request-status" label="Status">
          <select
            className={nativeSelectClassName}
            id="request-status"
            onChange={(event) => {
              setStatus(event.target.value as ProfileChangeStatus | "");
              setPage(1);
            }}
            value={status}
          >
            {statuses.map((item) => (
              <option key={item || "all"} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {result.isLoading ? (
        <LoadingState label="Loading profile-change requests…" />
      ) : result.error ? (
        <ErrorState message={result.error.message} />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Profile-change requests: {statusLabel(status).toLowerCase()}</caption>
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Submitted</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Employee note</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((request) => {
                    const submitted = new Date(request.created_at).toLocaleString();
                    return (
                      <tr className="border-t" key={request.id}>
                        <td className="px-4 py-3 align-top">
                          <Badge className="capitalize" variant={request.status === "approved" ? "secondary" : request.status === "rejected" ? "destructive" : "outline"}>
                            {request.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <time dateTime={request.created_at}>{submitted}</time>
                        </td>
                        <td className="max-w-md px-4 py-3 align-top break-words whitespace-pre-line text-muted-foreground">{request.note || "—"}</td>
                        <td className="px-4 py-3 align-top">
                          <Link
                            aria-label={`${request.status === "pending" ? "Review" : "View"} request submitted ${submitted}`}
                            className="font-medium text-primary underline underline-offset-4"
                            href={`/admin/profile-change-requests/${request.id}`}
                          >
                            {request.status === "pending" ? "Review" : "View"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <EmptyTableState
                      colSpan={4}
                      message={status ? `No ${status} requests. Choose another status to see more.` : "No profile-change requests have been submitted yet."}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginatedTableControls onPageChange={setPage} page={page} pageSize={20} totalCount={result.data?.count ?? 0} />
        </>
      )}
    </div>
  );
}
