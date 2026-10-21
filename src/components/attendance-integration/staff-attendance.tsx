"use client";

import { Camera, Expand, Eye, FileUp, IdCard, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { InitialsAvatar, avatarTone } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { SearchInput } from "@/components/ui/search-input";
import { useHrAttendanceLogs } from "@/hooks/use-attendance-integration";
import { usePanelParam } from "@/hooks/use-panel-param";
import { formatDate } from "@/lib/format-date";
import { ATTENDANCE_STATUS } from "@/lib/staff/status-maps";
import type { AttendanceStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useListParams } from "@/lib/workspace/list-params";

import { AttendanceKioskOverlay } from "./attendance-kiosk-overlay";
import { AttendanceRecordModal } from "./attendance-record-modal";
import { formatAttendanceTime, workedDuration } from "./attendance-time";

const PAGE_SIZE = 10;
const STATUSES: AttendanceStatus[] = ["present", "incomplete", "late", "absent"];
const toolLink = "flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";

/** Attendance Logs (Capstone UI attendance.html, PDF pp. 31–33). View and the kiosk open in place; there is no Kiosk page. */
export function StaffAttendance() {
  const [viewId, setView] = usePanelParam("view");
  const [kiosk, setKiosk] = usePanelParam("kiosk");
  // Search, status and page live in the URL, so reload, Back and shared links keep the same view.
  const { params, set } = useListParams(["q", "status", "page"] as const);
  const status = STATUSES.includes(params.status as AttendanceStatus) ? params.status as AttendanceStatus : "";
  const page = Math.max(1, Number(params.page) || 1);
  // The search runs on the server across every page: each word must match the name, badge number or external ID.
  const logs = useHrAttendanceLogs({ page, pageSize: PAGE_SIZE, status: status || undefined, search: params.q || undefined });
  const rows = logs.data?.rows ?? [];
  const viewed = viewId ? rows.find((log) => log.id === viewId) ?? null : null;
  const total = logs.data?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        actions={(
          <>
            <Link className={toolLink} href="/hr/attendance/import"><FileUp aria-hidden="true" className="size-3.5 text-blue-700" /><span>Import Attendance</span></Link>
            <Link className={toolLink} href="/hr/attendance/face-enrollment"><IdCard aria-hidden="true" className="size-3.5 text-purple-600" /><span>Face Registration</span></Link>
            <Link className={toolLink} href="/hr/attendance/unmatched"><TriangleAlert aria-hidden="true" className="size-3.5 text-amber-500" /><span>Unmatched IDs</span></Link>
            <button className={staffButton.primary} onClick={() => setKiosk("1")} type="button"><Expand aria-hidden="true" className="size-3.5" /><span>Launch Attendance Kiosk</span></button>
          </>
        )}
        subtitle="Review imported and face-scanned attendance records, resolve unmatched device IDs, or launch kiosk mode."
        title="Attendance Logs"
      />

      <section aria-label="Recent Attendance Logs" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Recent Attendance Logs</h2>
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700">{total} Records</span>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
            <SearchInput label="Search attendance logs" onChange={(q) => set({ q })} placeholder="Search name, badge no. or external ID..." value={params.q} variant="staff" />
            <select aria-label="Attendance status" className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none sm:w-40" onChange={(event) => set({ status: event.target.value })} value={status}>
              <option value="">All Statuses</option>
              {STATUSES.map((value) => <option key={value} value={value}>{ATTENDANCE_STATUS[value].label}</option>)}
            </select>
          </div>
        </div>
        {logs.isLoading ? <LoadingState label="Loading attendance logs…" /> : logs.error ? <ErrorState message={logs.error.message} onRetry={() => void logs.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className={staffTable.table}>
              <thead className={staffTable.thead}>
                <tr className="border-b border-slate-100">
                  {["Date", "Personnel Name", "External ID", "Time In", "Time Out", "Duration", "Status", "Source"].map((heading) => <th className={staffTable.th} key={heading} scope="col">{heading}</th>)}
                  <th className={cn(staffTable.th, "text-center")} scope="col">Action</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {rows.length ? rows.map((log) => {
                  const name = log.employee ? `${log.employee.first_name} ${log.employee.last_name}` : log.external_employee_id;
                  const pill = ATTENDANCE_STATUS[log.status];
                  const face = log.capture_method === "face_recognition";
                  return (
                    <tr className={staffTable.tr} key={log.id}>
                      <td className={cn(staffTable.td, "font-semibold text-slate-900")}>{formatDate(log.attendance_date)}</td>
                      <td className={staffTable.td}>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={name} size="sm" tone={avatarTone(name)} />
                          <div>
                            {log.employee ? <Link className="font-bold text-slate-900 hover:underline" href={`/hr/employees/${log.employee_id}`}>{name}</Link> : <p className="font-bold text-slate-900">{name}</p>}
                            <p className="font-mono text-[10px] text-slate-500">{log.external_employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn(staffTable.td, "font-mono font-bold")}>{log.external_employee_id}</td>
                      <td className={cn(staffTable.td, "font-mono font-semibold")}>{formatAttendanceTime(log.time_in)}</td>
                      <td className={cn(staffTable.td, "font-mono font-semibold", !log.time_out && "text-slate-500")}>{formatAttendanceTime(log.time_out)}</td>
                      <td className={cn(staffTable.td, "font-mono font-semibold", !log.time_out && "text-slate-500")}>{workedDuration(log.time_in, log.time_out)}</td>
                      <td className={staffTable.td}><StatusPill tone={pill.tone}>{pill.label}</StatusPill></td>
                      <td className={staffTable.td}>
                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {face ? <Camera aria-hidden="true" className="size-2.5" /> : <FileUp aria-hidden="true" className="size-2.5" />}
                          {face ? "Face scan" : "Imported"}
                        </span>
                      </td>
                      <td className={cn(staffTable.td, "text-center")}>
                        <button aria-label={`View attendance for ${name}, ${formatDate(log.attendance_date)}`} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setView(log.id)} title="View Details" type="button">
                          <Eye aria-hidden="true" className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                }) : <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={9}>{params.q || status ? "No attendance logs match your search or filter." : "No attendance logs found."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <StaffPager noun="attendance records" onPageChange={(next) => set({ page: String(next) })} page={page} pageSize={PAGE_SIZE} total={total} />
      </section>

      <AttendanceRecordModal log={viewed} missing={Boolean(viewId) && !viewed && !logs.isLoading} onClose={() => setView(null)} />
      <AttendanceKioskOverlay onClose={() => setKiosk(null)} open={kiosk === "1"} />
    </div>
  );
}
