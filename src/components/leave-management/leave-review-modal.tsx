"use client";

import { Check, FileSignature, Paperclip, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { LoadingState } from "@/components/ui/loading-state";
import { useDecideLeaveRequest, useEmployeeLeaveBalances, useLeaveRequest } from "@/hooks/use-leave-management";
import { formatDate } from "@/lib/format-date";
import { leaveDateRange, leaveEmployeeName } from "@/lib/leave-management/leave-type-style";
import { getLeaveAttachmentUrl } from "@/queries/leave-management";

function AttachmentLink({ objectPath, fileName }: { objectPath: string; fileName: string }) {
  async function open() {
    try {
      const url = await getLeaveAttachmentUrl(objectPath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      notifyStaff({ title: "Unable to open the attachment", description: cause instanceof Error ? cause.message : undefined, tone: "error" });
    }
  }
  return (
    <button aria-label={`Attachment: ${fileName}`} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => void open()} type="button">
      <Paperclip aria-hidden="true" className="size-3" />{fileName}
    </button>
  );
}

/** "Review Leave Request" (Capstone UI leave.html, PDF p. 27): HR remarks are required to approve or decline. */
export function LeaveReviewModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const request = useLeaveRequest(requestId);
  const data = request.data;
  const balances = useEmployeeLeaveBalances(data?.employee_id, Number((data?.starts_on ?? "2000").slice(0, 4)));
  const decide = useDecideLeaveRequest();
  const [note, setNote] = useState("");
  const [noteMissing, setNoteMissing] = useState(false);

  async function submit(decision: "approved" | "rejected") {
    if (decide.isPending) return;
    if (!note.trim()) { setNoteMissing(true); return; }
    try {
      await decide.mutateAsync({ requestId, decision, note: note.trim() });
      notifyStaff({ title: decision === "approved" ? "Leave request approved" : "Leave request declined" });
      onClose();
    } catch (cause) {
      notifyStaff({ title: "Could not record the decision", description: cause instanceof Error ? cause.message : undefined, tone: "error" });
    }
  }

  const isPending = data?.status === "pending";
  const credit = balances.data?.find((entry) => entry.leave_type_id === data?.leave_type_id);
  const attachments = (data as { leave_request_attachments?: { id: string; object_path: string; file_name: string }[] } | null | undefined)?.leave_request_attachments ?? [];

  return (
    <StaffModal
      footer={isPending ? (
        <>
          <button className={staffButton.secondary} onClick={onClose} type="button">Cancel</button>
          <div className="flex items-center gap-2">
            <button className={staffButton.danger} disabled={decide.isPending} onClick={() => void submit("rejected")} type="button"><X aria-hidden="true" className="size-3.5" /><span>Decline Request</span></button>
            <button className={staffButton.success} disabled={decide.isPending} onClick={() => void submit("approved")} type="button"><Check aria-hidden="true" className="size-3.5" /><span>Approve Request</span></button>
          </div>
        </>
      ) : <button className={staffButton.dark} onClick={onClose} type="button">Close Window</button>}
      footerClassName={isPending ? "justify-between" : undefined}
      icon={<FileSignature aria-hidden="true" className="size-3.5" />}
      iconClassName="bg-blue-100 text-blue-700"
      onClose={onClose}
      open
      subtitle="Approve or Decline application with required HR notes"
      title="Review Leave Request"
    >
      {request.isLoading ? <LoadingState label="Loading leave request…" /> : !data ? (
        <p className="font-semibold text-slate-600">This leave request could not be found.</p>
      ) : !isPending ? (
        <p className="font-semibold text-slate-600">This leave request was already decided.</p>
      ) : (
        <>
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{leaveEmployeeName(data)}</p>
                {data.employees?.employee_number ? <p className="font-mono text-[10px] text-slate-500">Badge: {data.employees.employee_number}</p> : null}
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">{data.leave_type_name}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 border-t border-slate-200/60 pt-1 text-[11px] sm:grid-cols-2">
              <div><span className="text-slate-500">Inclusive Dates:</span> <span className="font-semibold text-slate-800">{leaveDateRange(data.starts_on, data.ends_on, formatDate)}</span></div>
              <div><span className="text-slate-500">Submitted:</span> <span className="font-semibold text-slate-800">{formatDate(data.created_at)}</span></div>
            </div>
            {credit && credit.days_per_year !== null ? (
              <p className="text-[11px] font-semibold text-slate-800">{`Balance: ${Math.max(credit.days_per_year - credit.used_days, 0)} of ${credit.days_per_year} days`}</p>
            ) : null}
            {attachments.length ? (
              <div className="flex flex-wrap gap-3 border-t border-slate-200/60 pt-2 text-[11px]">
                {attachments.map((attachment) => <AttachmentLink fileName={attachment.file_name} key={attachment.id} objectPath={attachment.object_path} />)}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between font-bold text-slate-800" htmlFor="leave-hr-notes">
              <span>HR Remarks / Notes <span aria-hidden="true" className="text-rose-500">*</span></span>
              <span className="text-[10px] font-normal text-slate-500">Required before approving or declining</span>
            </label>
            <textarea
              aria-invalid={noteMissing}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs transition-all focus:ring-2 focus:ring-blue-600 focus:outline-none"
              id="leave-hr-notes"
              maxLength={2000}
              onChange={(event) => { setNote(event.target.value); setNoteMissing(false); }}
              placeholder="Enter justification, endorsement details, or reason for decline..."
              rows={3}
              value={note}
            />
            {noteMissing ? <p className="flex items-center gap-1 text-[10px] font-bold text-rose-500" role="alert"><TriangleAlert aria-hidden="true" className="size-3" /> HR Remarks are required to proceed.</p> : null}
          </div>
        </>
      )}
    </StaffModal>
  );
}
