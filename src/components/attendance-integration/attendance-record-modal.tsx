"use client";

import { Building2, Camera, FileUp, LogIn, LogOut, UserRoundSearch } from "lucide-react";

import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { formatDate } from "@/lib/format-date";
import { ATTENDANCE_STATUS } from "@/lib/staff/status-maps";
import type { AttendanceLogWithEmployee } from "@/queries/attendance-integration";

import { formatAttendanceTimeWithMeridiem, workedDuration } from "./attendance-time";

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

/** "Employee Attendance Record" (Capstone UI attendance.html View, PDF p. 32), with real data only: no match score is stored. */
export function AttendanceRecordModal({ log, missing, onClose }: { log: AttendanceLogWithEmployee | null; missing: boolean; onClose: () => void }) {
  const employee = log?.employee;
  const isFace = log?.capture_method === "face_recognition";
  const mode = typeof log?.sync_metadata?.mode === "string" ? (log.sync_metadata.mode as string) : null;
  const status = log ? ATTENDANCE_STATUS[log.status] : null;
  return (
    <StaffModal
      footer={<button className={staffButton.dark} onClick={onClose} type="button">Close Window</button>}
      icon={<UserRoundSearch aria-hidden="true" className="size-4" />}
      iconClassName="bg-blue-900 text-amber-400 shadow-sm"
      onClose={onClose}
      open={Boolean(log) || missing}
      subtitle="Detailed biometrics log and station verification"
      title="Employee Attendance Record"
    >
      {!log ? <p className="font-semibold text-slate-600">This attendance record could not be found.</p> : (
        <div className="space-y-5 font-medium text-slate-700">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-300 bg-blue-100 text-sm font-black text-blue-900 shadow-sm">
              {employee ? initials(employee.first_name, employee.last_name) : "—"}
            </span>
            <div className="space-y-0.5">
              <p className="text-base font-black text-slate-900">{employee ? `${employee.first_name} ${employee.last_name}` : log.external_employee_id}</p>
              <p className="font-mono text-[11px] text-slate-500">{`Rank: ${employee?.ranks?.code ?? "—"} • Badge / ID: ${employee?.employee_number ?? log.external_employee_id}`}</p>
              {employee?.departments?.name ? (
                <p className="flex items-center gap-1 text-[10px] font-bold text-blue-700"><Building2 aria-hidden="true" className="size-3" />{`San Juan City Police Station — ${employee.departments.name}`}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase">Log Date</span>
              <p className="text-xs font-bold text-slate-900">{formatDate(log.attendance_date)}</p>
            </div>
            <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase">Attendance Status</span>
              <div>{status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}</div>
            </div>
            <div className="space-y-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 uppercase"><LogIn aria-hidden="true" className="size-3" /> Time In</span>
              <p className="font-mono text-sm font-black text-emerald-950">{formatAttendanceTimeWithMeridiem(log.time_in)}</p>
            </div>
            <div className="space-y-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-rose-700 uppercase"><LogOut aria-hidden="true" className="size-3" /> Time Out</span>
              <p className="font-mono text-sm font-black text-rose-950">{formatAttendanceTimeWithMeridiem(log.time_out)}</p>
            </div>
            <div className="col-span-2 space-y-1 rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase">Worked Duration</span>
              <p className="font-mono text-sm font-black text-slate-900">{workedDuration(log.time_in, log.time_out)}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-blue-200/80 bg-blue-50/50 p-3.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">{isFace ? <Camera aria-hidden="true" className="size-3 text-blue-600" /> : <FileUp aria-hidden="true" className="size-3 text-blue-600" />} Verification Source:</span>
              <span className="rounded border border-blue-200 bg-blue-100 px-2 py-0.5 font-extrabold text-blue-900">{isFace ? "Face Scan Biometrics" : "Imported File"}</span>
            </div>
            {isFace ? (
              <div className="flex items-center justify-between border-t border-blue-100 pt-1.5 text-[11px]">
                <span className="text-slate-500">Scan Mode:</span>
                <span className="font-mono font-bold text-slate-800">{mode === "kiosk" ? "Kiosk" : mode === "self" ? "Self-service" : mode ?? "—"}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-blue-100 pt-1.5 text-[11px]">
                <span className="text-slate-500">Import File:</span>
                <span className="font-mono font-bold text-slate-800">{log.attendance_imports?.source_filename ?? "—"}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </StaffModal>
  );
}
