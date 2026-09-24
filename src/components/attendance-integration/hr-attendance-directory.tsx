"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrAttendanceLogs } from "@/hooks/use-attendance-integration";

import { AttendanceStatusBadge } from "./attendance-status-badge";

export function HrAttendanceDirectory() {
  const query = useHrAttendanceLogs({ page: 1, pageSize: 25 });
  if (query.isLoading) return <LoadingState label="Loading attendance history…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? rows.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total > rows.length ? `Showing ${rows.length} of ${total} records` : total === 1 ? "1 record" : `${total} records`}</p>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline" })} href="/hr/attendance/unmatched">Unmatched IDs</Link>
          <Link className={buttonVariants()} href="/hr/attendance/import">Import attendance</Link>
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Imported attendance records</caption>
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Date</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">External ID</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Time in</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Time out</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr className="border-t" key={row.id}>
                <td className="px-4 py-3 align-top whitespace-nowrap">{row.attendance_date}</td>
                <td className="px-4 py-3 align-top">{row.external_employee_id}</td>
                <td className="px-4 py-3 align-top tabular-nums">{row.time_in?.slice(11, 16) ?? "—"}</td>
                <td className="px-4 py-3 align-top tabular-nums">{row.time_out?.slice(11, 16) ?? "—"}</td>
                <td className="px-4 py-3 align-top"><AttendanceStatusBadge status={row.status} /></td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={5}>
                  No attendance records yet. <Link className="font-medium text-primary underline underline-offset-4" href="/hr/attendance/import">Import an attendance file</Link> to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
