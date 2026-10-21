"use client";

import { CalendarCheck, Clock, History, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useState } from "react";

import { StaffPager } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyAttendanceLogs } from "@/hooks/use-attendance-integration";
import { formatDate } from "@/lib/format-date";
import { ATTENDANCE_STATUS, type PillTone } from "@/lib/staff/status-maps";
import type { AttendanceStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { formatAttendanceTime, workedDuration } from "./attendance-time";

const PAGE_SIZE = 10;
const ICONS: Record<AttendanceStatus, typeof Clock> = { present: UserCheck, late: Clock, incomplete: Clock, absent: UserX };
const TILES: Record<PillTone, string> = { amber: "bg-amber-50 text-amber-700", emerald: "bg-emerald-50 text-emerald-700", rose: "bg-rose-50 text-rose-700", blue: "bg-blue-50 text-blue-700", slate: "bg-slate-100 text-slate-600" };

const manilaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

/** Personnel Monitoring heading with today's date in words (empfacere.html). */
export function EmployeeAttendanceHeader() {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-blue-900 uppercase"><ShieldCheck aria-hidden="true" className="size-3.5 text-amber-500" />Personnel Monitoring</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">My Attendance</h1>
        <p className="mt-0.5 text-xs font-medium text-slate-500">Review your attendance history, or record today&apos;s duty attendance using facial biometrics.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
        <CalendarCheck aria-hidden="true" className="size-4 text-blue-900" />
        <div className="text-right">
          <span className="block text-[10px] leading-none font-bold tracking-wider text-slate-500 uppercase">Today&apos;s Date</span>
          <span className="text-xs font-extrabold text-slate-800">{formatDate(manilaToday())}</span>
        </div>
      </div>
    </div>
  );
}

export function EmployeeAttendanceList() {
  const [page, setPage] = useState(1);
  const query = useMyAttendanceLogs({ page, pageSize: PAGE_SIZE });
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;

  return (
    <section aria-labelledby="attendance-logs-heading" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900" id="attendance-logs-heading"><History aria-hidden="true" className="size-4 text-blue-900" />Attendance Logs</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Recent Activity</span>
      </div>
      {query.isLoading ? <LoadingState label="Loading your attendance history…" /> : query.error ? <ErrorState message={query.error.message} /> : (
        <>
          <div className="space-y-3">
            {rows.length ? rows.map((row) => {
              const pill = ATTENDANCE_STATUS[row.status];
              const Icon = ICONS[row.status];
              return (
                <article className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 sm:flex-row sm:items-center" key={row.id}>
                  <div className="flex items-center gap-3.5">
                    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TILES[pill.tone])}><Icon aria-hidden="true" className="size-4" /></div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900">{formatDate(row.attendance_date)}</h3>
                      <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                    </div>
                  </div>
                  <dl className="flex w-full items-center justify-between gap-3 border-t border-slate-200 pt-2 sm:w-auto sm:justify-end sm:border-0 sm:pt-0">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center"><dt className="block text-[10px] leading-none font-bold text-slate-500 uppercase">Time In</dt><dd className="text-xs font-bold text-slate-900">{formatAttendanceTime(row.time_in)}</dd></div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center"><dt className="block text-[10px] leading-none font-bold text-slate-500 uppercase">Time Out</dt><dd className="text-xs font-bold text-slate-900">{formatAttendanceTime(row.time_out)}</dd></div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center"><dt className="block text-[10px] leading-none font-bold text-slate-500 uppercase">Duration</dt><dd className="text-xs font-bold text-slate-900">{workedDuration(row.time_in, row.time_out)}</dd></div>
                  </dl>
                </article>
              );
            }) : <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">No attendance records are available.</p>}
          </div>
          <StaffPager noun="attendance records" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </section>
  );
}
