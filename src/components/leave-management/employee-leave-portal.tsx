"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { usePanelParam } from "@/hooks/use-panel-param";
import { cn } from "@/lib/utils";

import { EmployeeLeaveCredits, EmployeeLeaveList } from "./employee-leave";
import { EmployeeLeaveRequestModal } from "./employee-leave-request-modal";

/** My Leave Portal: header, credits, history and the File Leave Application modal (opened by ?request=1). */
export function EmployeeLeavePortal() {
  const [request, setRequest] = usePanelParam("request");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const year = new Date().getFullYear();
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">My Leave Portal</h1>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">CY {year} Credits</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Track your available leave credits, monitor approval workflows, and file official leave applications.</p>
        </div>
        <button className={cn(staffButton.primary, "shrink-0")} onClick={() => { setSubmitted(null); setRequest("1"); }} type="button"><Plus aria-hidden="true" className="size-3.5" /><span>Request New Leave</span></button>
      </div>
      {submitted ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800" role="status">{submitted}</p> : null}
      <EmployeeLeaveCredits />
      <EmployeeLeaveList />
      <EmployeeLeaveRequestModal onOpenChange={(open) => { if (!open) setRequest(null); }} onSubmitted={setSubmitted} open={request === "1"} />
    </div>
  );
}
