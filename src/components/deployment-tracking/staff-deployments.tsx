"use client";

import { Ban, Eye, MapPin, Plus, SquarePen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton, staffIconButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { SearchInput } from "@/components/ui/search-input";
import { useCancelDeployment, useHrDeployments } from "@/hooks/use-deployment-tracking";
import { usePanelParam } from "@/hooks/use-panel-param";
import { DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";
import type { DeploymentStatus } from "@/lib/types/database";
import { deploymentEmployeeName, type DeploymentWithEmployee } from "@/queries/deployment-tracking";
import { cn } from "@/lib/utils";
import { DEPLOYMENT_STATUSES, DEPLOYMENT_TYPES } from "@/schemas/deployment-tracking";

import { DeploymentPanel } from "./deployment-panel";

const PAGE_SIZE = 10;
const filterClassName = "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none";

/** Duty Deployments (Capstone UI dep.html, PDF pp. 24–25). "New Deployment" and Edit open the side panel in place. */
export function StaffDeployments() {
  const [create, setCreate] = usePanelParam("create");
  const [edit, setEdit] = usePanelParam("edit");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DeploymentStatus | "">("");
  const [type, setType] = useState<(typeof DEPLOYMENT_TYPES)[number] | "">("");
  const [search, setSearch] = useState("");
  const deployments = useHrDeployments({ page, pageSize: PAGE_SIZE, status: status || undefined, deploymentType: type || undefined, search: search || undefined });
  const cancelMutation = useCancelDeployment();

  // Searched on the server across every page: each word must match the name, badge number or location.
  const rows = deployments.data?.rows ?? [];

  async function cancel(deployment: DeploymentWithEmployee) {
    if (!window.confirm("Cancel this deployment?")) return;
    try {
      await cancelMutation.mutateAsync({ id: deployment.id, expectedUpdatedAt: deployment.updated_at });
      notifyStaff({ title: "Deployment cancelled" });
    } catch (error) {
      notifyStaff({ title: "Could not cancel deployment", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  const panelMode = create === "1" ? { kind: "create" as const } : edit ? { kind: "edit" as const, id: edit } : null;

  return (
    <div className="space-y-6">
      <PageTitle
        actions={<button className={staffButton.primary} onClick={() => setCreate("1")} type="button"><Plus aria-hidden="true" className="size-3.5" /><span>New Deployment</span></button>}
        subtitle="Create and manage personnel deployments and approve status updates."
        title="DEPLOYMENTS"
      />

      <section aria-label="Deployments" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <SearchInput className="sm:w-full lg:col-span-5" label="Search deployments" onChange={(next) => { setSearch(next); setPage(1); }} placeholder="Search employee name, badge number or location..." value={search} variant="staff" />
            <div className="lg:col-span-4">
              <select aria-label="Deployment type" className={filterClassName} onChange={(event) => { setType(event.target.value as typeof type); setPage(1); }} value={type}>
                <option value="">Deployment Types</option>
                {DEPLOYMENT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div className="lg:col-span-3">
              <select aria-label="Deployment status" className={filterClassName} onChange={(event) => { setStatus(event.target.value as DeploymentStatus | ""); setPage(1); }} value={status}>
                <option value="">All Statuses</option>
                {DEPLOYMENT_STATUSES.map((value) => <option key={value} value={value}>{DEPLOYMENT_STATUS[value].label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {deployments.isLoading ? <LoadingState label="Loading deployments…" /> : deployments.error ? <ErrorState message={deployments.error.message} onRetry={() => void deployments.refetch()} /> : (
          <div className="overflow-x-auto">
            <table className={staffTable.table}>
              <thead className={staffTable.thead}>
                <tr className="border-b border-slate-100">
                  {["Rank", "Name", "Badge Number", "Task", "Location", "Status"].map((heading) => <th className={staffTable.th} key={heading} scope="col">{heading}</th>)}
                  <th className={cn(staffTable.th, "text-center")} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {rows.length ? rows.map((deployment) => {
                  const employee = deployment.employee;
                  const name = deploymentEmployeeName(employee) ?? "Personnel";
                  const pill = DEPLOYMENT_STATUS[deployment.status];
                  return (
                    <tr className={staffTable.tr} key={deployment.id}>
                      <td className={cn(staffTable.td, "font-bold text-slate-800")}>{employee?.rank?.code ?? "—"}</td>
                      <td className={staffTable.td}><p className="text-sm font-bold text-slate-900">{name}</p></td>
                      <td className={cn(staffTable.td, "font-mono text-[11px] text-slate-600")}>{employee?.employee_number ?? "—"}</td>
                      <td className={staffTable.td}>{deployment.task}</td>
                      <td className={staffTable.td}><span className="flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-3 text-slate-500" />{deployment.location ?? "—"}</span></td>
                      <td className={staffTable.td}>
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                          {deployment.proposed_status ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={`The employee marked this deployment as ${DEPLOYMENT_STATUS[deployment.proposed_status].label}.`}>Update for approval</span> : null}
                        </div>
                      </td>
                      <td className={staffTable.td}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Link aria-label="View Details" className={cn(staffIconButton, "hover:bg-blue-50 hover:text-blue-600")} href={`/hr/deployments/${deployment.id}`} title="View Details"><Eye aria-hidden="true" className="size-3.5" /></Link>
                          <button aria-label="Edit Deployment" className={cn(staffIconButton, "hover:bg-amber-50 hover:text-amber-600")} onClick={() => setEdit(deployment.id)} title="Edit Deployment" type="button"><SquarePen aria-hidden="true" className="size-3.5" /></button>
                          {deployment.status === "scheduled" || deployment.status === "ongoing" ? (
                            <button aria-label="Cancel Deployment" className={cn(staffIconButton, "hover:bg-rose-50 hover:text-rose-600")} disabled={cancelMutation.isPending} onClick={() => void cancel(deployment)} title="Cancel Deployment" type="button"><Ban aria-hidden="true" className="size-3.5" /></button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={7}>No deployments match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <StaffPager noun="deployments" onPageChange={setPage} page={page} pageSize={PAGE_SIZE} total={deployments.data?.count ?? 0} />
      </section>

      <DeploymentPanel mode={panelMode} onClose={() => { if (create) setCreate(null); if (edit) setEdit(null); }} />
    </div>
  );
}
