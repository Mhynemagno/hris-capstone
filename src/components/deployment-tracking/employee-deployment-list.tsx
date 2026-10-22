"use client";

import { Calendar, CircleCheck, CircleX, ClipboardList, Clock, Hourglass, MapPin, ShieldCheck } from "lucide-react";
import { useState, type ComponentType } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffLabel, StaffSelect } from "@/components/staff-shell/ui/staff-fields";
import { StaffPager } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDeploymentReports, useMyDeployments, useProposeDeploymentStatus } from "@/hooks/use-deployment-tracking";
import { formatDate } from "@/lib/format-date";
import { DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";
import type { Deployment, DeploymentStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { DeploymentReports } from "./deployment-reports";

const PAGE_SIZE = 10;

// Card accents per status (empdeploy.html: ongoing blue, scheduled amber); completed/cancelled follow the status pill tones.
const accents: Record<DeploymentStatus, { border: string; tile: string; Icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }> }> = {
  ongoing: { border: "border-l-blue-900", tile: "bg-blue-50 text-blue-900", Icon: MapPin },
  scheduled: { border: "border-l-amber-500", tile: "bg-amber-50 text-amber-700", Icon: Clock },
  completed: { border: "border-l-emerald-500", tile: "bg-emerald-50 text-emerald-700", Icon: CircleCheck },
  cancelled: { border: "border-l-rose-500", tile: "bg-rose-50 text-rose-700", Icon: CircleX },
};

const pillClass: Record<DeploymentStatus, string> = {
  ongoing: "border-blue-900 bg-blue-900 text-white",
  scheduled: "border-amber-200 bg-amber-100 text-amber-800",
  completed: "",
  cancelled: "",
};

function dateRange(row: Deployment) {
  const end = formatDate(row.ends_on) ?? (row.status === "ongoing" ? "Present" : "Open Ended");
  return `${formatDate(row.starts_on)} – ${end}`;
}

/**
 * The deployed employee proposes Ongoing or Completed after uploading proof; HR approves or
 * rejects it. Completed needs at least one submitted report.
 */
function DeploymentStatusUpdate({ row }: { row: Deployment }) {
  const reports = useDeploymentReports(row.id);
  const propose = useProposeDeploymentStatus();
  if (row.status !== "scheduled" && row.status !== "ongoing") return null;
  if (row.proposed_status) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
        <Hourglass aria-hidden="true" className="size-3.5" />
        <span>{DEPLOYMENT_STATUS[row.proposed_status].label} update sent. Waiting for HR approval.</span>
      </p>
    );
  }
  const hasProof = Boolean(reports.data?.length);

  async function send(status: "ongoing" | "completed") {
    try {
      await propose.mutateAsync({ deploymentId: row.id, status });
      notifyStaff({ title: "Status update sent for approval" });
    } catch (error) {
      notifyStaff({ title: "Could not send the status update", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-xs font-bold text-slate-900">Update deployment status</p>
      <div className="flex flex-wrap gap-2">
        {row.status === "scheduled" ? <button className={staffButton.secondary} disabled={propose.isPending} onClick={() => void send("ongoing")} type="button">Mark as Ongoing</button> : null}
        <button className={staffButton.primary} disabled={propose.isPending || !hasProof} onClick={() => void send("completed")} type="button">Mark as Completed</button>
      </div>
      <p className="text-[10px] font-medium text-slate-500">{hasProof ? "HR reviews your update before the status changes." : "Upload a report or proof of attendance before marking the deployment as completed."}</p>
    </div>
  );
}

function DeploymentCard({ row }: { row: Deployment }) {
  const [open, setOpen] = useState(false);
  const accent = accents[row.status];
  const pill = DEPLOYMENT_STATUS[row.status];
  const Icon = accent.Icon;
  const detail = [row.task, row.deployment_type, row.event_operation].filter(Boolean).join(" · ");
  return (
    <article className={cn("rounded-2xl border border-l-4 border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300", accent.border)}>
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <div className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", accent.tile)}><Icon aria-hidden="true" className="size-4" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900">{row.location || "Deployment"}</h3>
              <StatusPill className={pillClass[row.status]} tone={pill.tone}>{pill.label}</StatusPill>
              {row.proposed_status ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Update for approval</span> : null}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Calendar aria-hidden="true" className="size-3" /><span>{dateRange(row)}</span></p>
            {detail ? <p className="mt-0.5 text-xs font-medium text-slate-500">{detail}</p> : null}
          </div>
        </div>
        <button aria-expanded={open} className={cn(row.status === "ongoing" ? staffButton.primary : staffButton.secondary, "shrink-0")} onClick={() => setOpen((value) => !value)} type="button">
          <ClipboardList aria-hidden="true" className={cn("size-4", row.status === "ongoing" ? "text-amber-400" : "text-blue-800")} />
          <span>Report / Proof of Attendance</span>
        </button>
      </div>
      {open ? <div className="mt-3 space-y-3"><DeploymentReports deploymentId={row.id} /><DeploymentStatusUpdate row={row} /></div> : null}
    </article>
  );
}

/** My Deployments (Capstone UI empdeploy.html): the signed-in employee's own deployments, filtered server-side by status. */
export function EmployeeDeploymentList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DeploymentStatus | "">("");
  const query = useMyDeployments({ page, pageSize: PAGE_SIZE, ...(status ? { status } : {}) });
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;
  const settled = !query.isLoading && !query.error;

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wider text-blue-900 uppercase"><ShieldCheck aria-hidden="true" className="size-3.5 text-amber-500" />Personnel Assignment Module</div>
        <PageTitle
          actions={
            <div className="w-44">
              <StaffLabel className="sr-only" htmlFor="deployment-status-filter">Filter Status</StaffLabel>
              <StaffSelect id="deployment-status-filter" onChange={(event) => { setStatus(event.target.value as DeploymentStatus | ""); setPage(1); }} value={status}>
                <option value="">All statuses</option>
                {(Object.keys(DEPLOYMENT_STATUS) as DeploymentStatus[]).map((value) => <option key={value} value={value}>{DEPLOYMENT_STATUS[value].label}</option>)}
              </StaffSelect>
            </div>
          }
          subtitle="Review your duties, upload proof of attendance and update their status."
          title="My Deployments"
        />
      </div>
      {query.isLoading ? <LoadingState label="Loading your deployments…" /> : null}
      {query.error ? <ErrorState message={query.error.message} /> : null}
      {settled ? (
        <>
          <div className="space-y-4">
            {rows.length ? rows.map((row) => <DeploymentCard key={row.id} row={row} />) : (
              <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs font-medium text-slate-500">{status ? `No ${DEPLOYMENT_STATUS[status].label.toLowerCase()} deployments found.` : "No deployments recorded."}</p>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><StaffPager noun="deployments" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={total} /></div>
        </>
      ) : null}
    </section>
  );
}
