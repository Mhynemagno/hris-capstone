"use client";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyAttendanceLogs } from "@/hooks/use-attendance-integration";
import { AttendanceStatusBadge } from "./attendance-status-badge";

export function EmployeeAttendanceList() { const query = useMyAttendanceLogs({ page: 1, pageSize: 25 }); if (query.isLoading) return <LoadingState label="Loading your attendance history…" />; if (query.error) return <ErrorState message={query.error.message} />; const rows = query.data?.rows ?? []; return <section className="space-y-3">{rows.length ? rows.map((row) => <article className="rounded-xl border p-4" key={row.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{row.attendance_date}</p><AttendanceStatusBadge status={row.status} /></div><p className="mt-2 text-sm text-muted-foreground">In: {row.time_in?.slice(11, 16) ?? "—"} · Out: {row.time_out?.slice(11, 16) ?? "—"}</p></article>) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No attendance records are available.</p>}</section>; }
