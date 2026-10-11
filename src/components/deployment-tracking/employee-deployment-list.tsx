"use client";

import { Calendar, CircleCheck, CircleX, ClipboardList, Clock, Info, MapPin, ShieldCheck } from "lucide-react";
import { useState, type ComponentType } from "react";

import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffLabel, StaffSelect } from "@/components/staff-shell/ui/staff-fields";
import { StaffPager } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyDeployments } from "@/hooks/use-deployment-tracking";
import { formatDate } from "@/lib/format-date";
import { DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";
import type { Deployment, DeploymentStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { DeploymentReports } from "./deployment-reports";

const PAGE_SIZE = 10;

// Card accents per status (empdeploy.html: ongoing blue, scheduled amber); completed/cancelled follow the status pill tones.
const accents: Record<DeploymentStatus, { border: string; tile: string; info: string; Icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }> }> = {
  ongoing: { border: "border-l-blue-900", tile: "bg-blue-50 text-blue-900", info: "text-blue-800", Icon: MapPin },
  scheduled: { border: "border-l-amber-500", tile: "bg-amber-50 text-amber-700", info: "text-amber-600", Icon: Clock },
  completed: { border: "border-l-emerald-500", tile: "bg-emerald-50 text-emerald-700", info: "text-emerald-600", Icon: CircleCheck },
  cancelled: { border: "border-l-rose-500", tile: "bg-rose-50 text-rose-700", info: "text-rose-600", Icon: CircleX },
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

function DeploymentCard({ row }: { row: Deployment }) {
  const [open, setOpen] = useState(false);
  const accent = accents[row.status];
  const pill = DEPLOYMENT_STATUS[row.status];
  const Icon = accent.Icon;
  const detail = [row.deployment_type, row.event_operation].filter(Boolean).join(" · ");
  return (
    <article className={cn("rounded-2xl border border-l-4 border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300", accent.border)}>
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <div className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", accent.tile)}><Icon aria-hidden="true" className="size-4" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900">{row.location || "Deployment"}</h3>
              <StatusPill className={pillClass[row.status]} tone={pill.tone}>{pill.label}</StatusPill>
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
      {row.notes ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-700">
          <Info aria-hidden="true" className={cn("mt-0.5 size-3.5 shrink-0", accent.info)} />
          <p><span className="font-bold text-slate-900">Remarks:</span> {row.notes}</p>
        </div>
      ) : null}
      {open ? <div className="mt-3"><DeploymentReports deploymentId={row.id} /></div> : null}
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
          subtitle="Review your current active duties and deployment history."
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
