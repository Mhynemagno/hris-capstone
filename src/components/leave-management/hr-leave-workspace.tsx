"use client";

import { ClipboardList, Tags } from "lucide-react";
import { HrLeaveQueue } from "@/components/leave-management/hr-leave";
import { LeaveTypeManager } from "@/components/leave-management/leave-type-manager";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useListParams } from "@/lib/workspace/list-params";
import type { LeaveRequestStatus } from "@/lib/types/database";

const statuses = ["pending", "approved", "rejected", "cancelled"] as const;
export function HrLeaveWorkspace() {
  const { params, set } = useListParams(["tab", "status", "page"] as const);
  const tab = params.tab === "types" ? "types" : "requests";
  const status = statuses.includes(params.status as LeaveRequestStatus) ? params.status as LeaveRequestStatus : "";
  const page = Math.max(1, Number(params.page) || 1);
  return <section className="rounded-xl border bg-card p-5"><Tabs items={[{ value: "requests", label: <span className="inline-flex items-center gap-2"><ClipboardList className="size-4 text-amber-600"/>Requests</span> }, { value: "types", label: <span className="inline-flex items-center gap-2"><Tags className="size-4 text-sky-600"/>Leave types</span> }]} label="Leave workspaces" onValueChange={(next) => set({ tab: next, status: next === "types" ? "" : status })} value={tab}><TabPanel value="requests"><HrLeaveQueue onPageChange={(next) => set({ page: String(next) })} onStatusChange={(next) => set({ status: next })} page={page} status={status}/></TabPanel><TabPanel value="types"><LeaveTypeManager page={page} onPageChange={(next) => set({ page: String(next) })}/></TabPanel></Tabs></section>;
}
