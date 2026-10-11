"use client";

import Link from "next/link";

import { PaginatedTableControls } from "@/components/administration/paginated-table-controls";
import { EmptyTableState } from "@/components/ui/empty-table-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { useAdminProfileChangeRequests } from "@/hooks/use-profile-change-requests";
import { formatDateTime } from "@/lib/format-date";
import { useListParams } from "@/lib/workspace/list-params";
import type { ProfileChangeStatus } from "@/schemas/profile-change-requests";

// "All statuses" is the default and includes pending requests, so they can still be actioned.
const statuses: Array<ProfileChangeStatus | ""> = ["", "approved", "rejected"];
const statusLabel = (status: ProfileChangeStatus | "") => (status ? status[0].toUpperCase() + status.slice(1) : "All statuses");

export function AdminProfileChangeRequestQueue() {
  const { params, set } = useListParams(["status", "page"] as const);
  const page = Math.max(1, Number(params.page) || 1);
  const status = statuses.includes(params.status as ProfileChangeStatus) ? params.status as ProfileChangeStatus : "";
  const result = useAdminProfileChangeRequests({ page, pageSize: 10, ...(status ? { status } : {}) });
  const rows = result.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <FormField htmlFor="request-status" label="Status">
          <select
            className={nativeSelectClassName}
            id="request-status"
            onChange={(event) => set({ status: event.target.value })}
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
        <LoadingState label="Loading requests…" />
      ) : result.error ? (
        <ErrorState message={result.error.message} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            <table className={staffTable.table}>
              <caption className="sr-only">Reviews and approvals: {statusLabel(status).toLowerCase()}</caption>
              <thead className={staffTable.thead}>
                <tr>
                  <th className={staffTable.th} scope="col">Status</th>
                  <th className={staffTable.th} scope="col">Submitted</th>
                  <th className={staffTable.th} scope="col">Employee note</th>
                  <th className={staffTable.th} scope="col">Action</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {rows.length ? (
                  rows.map((request) => {
                    const submitted = formatDateTime(request.created_at);
                    return (
                      <tr className={staffTable.tr} key={request.id}>
                        <td className={staffTable.td}>
                          <StatusPill tone={request.status === "approved" ? "emerald" : request.status === "rejected" ? "rose" : "amber"}>{request.status}</StatusPill>
                        </td>
                        <td className={staffTable.td}>
                          <time dateTime={request.created_at}>{submitted}</time>
                        </td>
                        <td className={`${staffTable.td} max-w-md break-words whitespace-pre-line text-slate-500`}>{request.note || "—"}</td>
                        <td className={staffTable.td}>
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
          {result.data?.count ? <PaginatedTableControls onPageChange={(next) => set({ page: String(next) })} page={page} pageSize={10} totalCount={result.data.count} /> : null}
        </>
      )}
    </div>
  );
}
