"use client";

import { Eye } from "lucide-react";

import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { LoadingState } from "@/components/ui/loading-state";
import { useLeaveRequest } from "@/hooks/use-leave-management";
import { formatDate } from "@/lib/format-date";
import { dayCount, leaveDays } from "@/lib/leave-days";
import { leaveDateRange, leaveEmployeeName } from "@/lib/leave-management/leave-type-style";
import { LEAVE_STATUS } from "@/lib/staff/status-maps";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/** "Leave Application Details" (Capstone UI leave.html view modal). */
export function LeaveDetailsModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const request = useLeaveRequest(requestId);
  const data = request.data;
  return (
    <StaffModal
      footer={<button className={staffButton.dark} onClick={onClose} type="button">Close</button>}
      icon={<Eye aria-hidden="true" className="size-3.5" />}
      iconClassName="bg-slate-200 text-slate-700"
      onClose={onClose}
      open
      title="Leave Application Details"
    >
      {request.isLoading ? <LoadingState label="Loading leave request…" /> : !data ? (
        <p className="font-semibold text-slate-600">This leave request could not be found.</p>
      ) : (
        <>
          <div className="space-y-2 font-medium text-slate-700">
            <Row label="Employee Name:"><span className="text-sm font-bold text-slate-900">{leaveEmployeeName(data)}</span></Row>
            <Row label="Badge Number:"><span className="font-mono font-bold text-slate-800">{data.employees?.employee_number ?? "—"}</span></Row>
            <Row label="Leave Type:"><span className="font-bold text-slate-800">{data.leave_type_name}</span></Row>
            <Row label="Inclusive Dates:">
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span className="font-semibold text-slate-800">{leaveDateRange(data.starts_on, data.ends_on, formatDate)}</span>
                <StatusPill tone="blue">{dayCount(leaveDays(data.starts_on, data.ends_on))}</StatusPill>
              </span>
            </Row>
            {data.excess_days > 0 ? <Row label="Days Deducted:"><StatusPill tone="amber">{dayCount(data.excess_days)}</StatusPill></Row> : null}
            <Row label="Date Submitted:"><span className="text-slate-600">{formatDate(data.created_at)}</span></Row>
            <Row label="Current Status:"><StatusPill tone={LEAVE_STATUS[data.status].tone}>{LEAVE_STATUS[data.status].label}</StatusPill></Row>
          </div>
          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <p className="font-bold text-slate-800">Remarks:</p>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs text-slate-600 italic">{data.decision_note || "No remarks provided."}</div>
          </div>
        </>
      )}
    </StaffModal>
  );
}
