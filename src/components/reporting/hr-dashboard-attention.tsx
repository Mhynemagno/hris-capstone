"use client";

import Link from "next/link";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { LeaveRequestTable } from "@/components/leave-management/leave-request-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useHrAttendanceLogs } from "@/hooks/use-attendance-integration";
import { useHrLeaveRequests } from "@/hooks/use-leave-management";
import { formatDate } from "@/lib/format-date";
import { useListParams } from "@/lib/workspace/list-params";

export function HrDashboardAttention() {
  const { params, set } = useListParams(["attention"] as const);
  const tab = params.attention === "attendance" ? "attendance" : "leave";
  const leave = useHrLeaveRequests({ page: 1, pageSize: 10, status: "pending" });
  const attendance = useHrAttendanceLogs({ page: 1, pageSize: 10, statuses: ["late", "absent", "incomplete"] });
  return <section aria-labelledby="needs-attention" className="rounded-lg border bg-card"><h2 className="border-b px-5 py-3 text-lg font-semibold" id="needs-attention">Needs attention</h2><div className="p-5"><Tabs items={[{ value: "leave", label: <span className="inline-flex items-center gap-2"><CalendarClock className="size-4 text-amber-600"/>Leave requests for approval</span> }, { value: "attendance", label: <span className="inline-flex items-center gap-2"><TriangleAlert className="size-4 text-red-600"/>Attendance exceptions</span> }]} label="Needs attention" onValueChange={(next) => set({ attention: next === "leave" ? "" : next })} value={tab}><TabPanel value="leave">{leave.isLoading ? <LoadingState label="Loading leave requests…"/> : leave.error ? <ErrorState message={leave.error.message}/> : leave.data?.rows.length ? <LeaveRequestTable emptyMessage="No leave requests need approval." rows={leave.data.rows} status="pending"/> : <EmptyState action={<Link href="/hr/leave-requests?tab=requests">View full Leave workspace</Link>} title="No leave requests need approval"/>}<Link className="mt-4 inline-block font-medium text-primary hover:underline" href="/hr/leave-requests?tab=requests&status=pending">View full Leave workspace →</Link></TabPanel><TabPanel value="attendance">{attendance.isLoading ? <LoadingState label="Loading attendance exceptions…"/> : attendance.error ? <ErrorState message={attendance.error.message}/> : attendance.data?.rows.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/60"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Badge</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{attendance.data.rows.map((row) => <tr className="border-t" key={row.id}><td className="px-4 py-3">{formatDate(row.attendance_date)}</td><td className="px-4 py-3">{row.external_employee_id}</td><td className="px-4 py-3 capitalize">{row.status}</td></tr>)}</tbody></table></div> : <EmptyState action={<Link href="/hr/attendance">View full attendance workspace</Link>} title="No attendance exceptions"/>}<Link className="mt-4 inline-block font-medium text-primary hover:underline" href="/hr/attendance">View full attendance workspace →</Link></TabPanel></Tabs></div></section>;
}
