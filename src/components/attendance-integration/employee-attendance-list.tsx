"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { useMyAttendanceLogs } from "@/hooks/use-attendance-integration";
import { formatDate } from "@/lib/format-date";
import { AttendanceStatusBadge } from "./attendance-status-badge";
import { formatAttendanceTime } from "./attendance-time";

export function EmployeeAttendanceList() {
  const [page, setPage] = useState(1);
  const query = useMyAttendanceLogs({ page, pageSize: 10 });
  if (query.isLoading) return <LoadingState label="Loading your attendance history…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;

  return <section className="space-y-3">{rows.length ? rows.map((row) => <article className="rounded-xl border p-4" key={row.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{formatDate(row.attendance_date)}</p><AttendanceStatusBadge status={row.status} /></div><p className="mt-2 text-sm text-muted-foreground">In: {formatAttendanceTime(row.time_in)} · Out: {formatAttendanceTime(row.time_out)}</p></article>) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No attendance records are available.</p>}<Pagination from={rows.length ? (page - 1) * 10 + 1 : 0} noun="attendance records" onPageChange={setPage} page={page} pageCount={Math.max(1, Math.ceil(total / 10))} to={Math.min(page * 10, total)} total={total} /></section>;
}
