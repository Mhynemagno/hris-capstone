"use client";

import { Eye, MapPin, Plus, Search, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ZodError } from "zod";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { InitialsAvatar, avatarTone } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton, staffIconButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffPager, staffTable } from "@/components/staff-shell/ui/staff-table-card";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployeeOptions, useHrDeployments, useUpdateDeployment } from "@/hooks/use-deployment-tracking";
import { usePanelParam } from "@/hooks/use-panel-param";
import { formatDate } from "@/lib/format-date";
import { DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";
import type { Deployment, DeploymentStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { DEPLOYMENT_STATUSES, DEPLOYMENT_TYPES } from "@/schemas/deployment-tracking";

import { DeploymentPanel } from "./deployment-panel";

const PAGE_SIZE = 10;
const filterClassName = "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pr-8 pl-3 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none";

function dates(deployment: Deployment) {
  return `${formatDate(deployment.starts_on)} – ${deployment.ends_on ? formatDate(deployment.ends_on) : "No end date"}`;
}

/** Duty Deployments (Capstone UI dep.html, PDF pp. 24–25). "New Deployment" and Edit open the side panel in place. */
export function StaffDeployments() {
  const [create, setCreate] = usePanelParam("create");
  const [edit, setEdit] = usePanelParam("edit");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DeploymentStatus | "">("");
  const [type, setType] = useState<(typeof DEPLOYMENT_TYPES)[number] | "">("");
  const [query, setQuery] = useState("");
  const deployments = useHrDeployments({ page, pageSize: PAGE_SIZE, status: status || undefined, deploymentType: type || undefined });
  const employees = useEmployeeOptions();
  const update = useUpdateDeployment();
  const employeeById = useMemo(() => new Map((employees.data ?? []).map((employee) => [employee.id, employee])), [employees.data]);

  const term = query.trim().toLowerCase();
  const rows = (deployments.data?.rows ?? []).filter((deployment) => {
    if (!term) return true;
    const employee = employeeById.get(deployment.employee_id);
    return [employee?.fullName, employee?.employeeNumber, deployment.location].some((value) => (value ?? "").toLowerCase().includes(term));
  });

  async function cancel(deployment: Deployment) {
    if (!window.confirm("Cancel or delete this deployment?")) return;
    try {
      await update.mutateAsync({
        id: deployment.id,
        expectedUpdatedAt: deployment.updated_at,
        employeeId: deployment.employee_id,
        location: deployment.location ?? "",
        unit: deployment.unit,
        startsOn: deployment.starts_on,
        endsOn: deployment.ends_on,
        status: "cancelled",
        deploymentType: deployment.deployment_type as (typeof DEPLOYMENT_TYPES)[number],
        eventOperation: deployment.event_operation as never,
        notes: deployment.notes ?? "",
      });
      notifyStaff({ title: "Deployment cancelled" });
    } catch (error) {
      const description = error instanceof ZodError
        ? "This older deployment is missing details. Open Edit, complete it, then set the status to Cancelled."
        : error instanceof Error ? error.message : undefined;
      notifyStaff({ title: "Could not cancel deployment", description, tone: "error" });
    }
  }

  const panelMode = create === "1" ? { kind: "create" as const } : edit ? { kind: "edit" as const, id: edit } : null;

  return (
    <div className="space-y-6">
      <PageTitle
        actions={<button className={staffButton.primary} onClick={() => setCreate("1")} type="button"><Plus aria-hidden="true" className="size-3.5" /><span>New Deployment</span></button>}
        subtitle="Create and manage personnel deployments without losing their history."
        title="DEPLOYMENTS"
      />

      <section aria-label="Deployments" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="relative lg:col-span-5">
              <input aria-label="Search deployments" className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-9 text-xs font-medium transition-all focus:ring-2 focus:ring-blue-600 focus:outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Search employee name or badge number..." type="search" value={query} />
              <Search aria-hidden="true" className="absolute top-1/2 left-3.5 size-3 -translate-y-1/2 text-slate-500" />
            </div>
            <div className="lg:col-span-4">
              <select aria-label="Deployment type" className={filterClassName} onChange={(event) => { setType(event.target.value as typeof type); setPage(1); }} value={type}>
                <option value="">All Deployment Types</option>
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
                  {["Employee", "Location", "Type / Event", "Dates", "Status"].map((heading) => <th className={staffTable.th} key={heading} scope="col">{heading}</th>)}
                  <th className={cn(staffTable.th, "text-center")} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className={staffTable.tbody}>
                {rows.length ? rows.map((deployment) => {
                  const employee = employeeById.get(deployment.employee_id);
                  const name = employee?.fullName ?? "Personnel";
                  const pill = DEPLOYMENT_STATUS[deployment.status];
                  return (
                    <tr className={staffTable.tr} key={deployment.id}>
                      <td className={staffTable.td}>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={name} tone={avatarTone(name)} />
                          <div>
                            <p className="text-sm font-bold text-slate-900">{name}</p>
                            {employee ? <p className="font-mono text-[10px] text-slate-500">Badge: {employee.employeeNumber}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className={staffTable.td}><span className="flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-3 text-slate-500" />{deployment.location ?? "—"}</span></td>
                      <td className={staffTable.td}>
                        <p className="font-bold text-slate-800">{deployment.deployment_type ?? "—"}</p>
                        {deployment.event_operation ? <p className="text-[10px] text-slate-500">{deployment.event_operation}</p> : null}
                      </td>
                      <td className={cn(staffTable.td, "font-mono text-[11px] text-slate-600")}>{dates(deployment)}</td>
                      <td className={staffTable.td}><StatusPill tone={pill.tone}>{pill.label}</StatusPill></td>
                      <td className={staffTable.td}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Link aria-label="View Details" className={cn(staffIconButton, "hover:bg-blue-50 hover:text-blue-600")} href={`/hr/deployments/${deployment.id}`} title="View Details"><Eye aria-hidden="true" className="size-3.5" /></Link>
                          <button aria-label="Edit Deployment" className={cn(staffIconButton, "hover:bg-amber-50 hover:text-amber-600")} onClick={() => setEdit(deployment.id)} title="Edit Deployment" type="button"><SquarePen aria-hidden="true" className="size-3.5" /></button>
                          {deployment.status !== "cancelled" ? (
                            <button aria-label="Delete Deployment" className={cn(staffIconButton, "hover:bg-rose-50 hover:text-rose-600")} disabled={update.isPending} onClick={() => void cancel(deployment)} title="Delete Deployment" type="button"><Trash2 aria-hidden="true" className="size-3.5" /></button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td className="px-6 py-10 text-center text-xs text-slate-500" colSpan={6}>No deployments match these filters.</td></tr>}
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
