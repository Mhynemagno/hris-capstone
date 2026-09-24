"use client";

import Link from "next/link";
import { useMemo } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployeeOptions, useHrDeployments } from "@/hooks/use-deployment-tracking";

import { DeploymentStatusBadge } from "./deployment-status-badge";

export function HrDeploymentDirectory() {
  const query = useHrDeployments({ page: 1, pageSize: 25 });
  const employees = useEmployeeOptions();
  const employeeById = useMemo(() => new Map((employees.data ?? []).map((employee) => [employee.id, employee])), [employees.data]);
  const newDeploymentLink = <Link className={buttonVariants({ className: "w-full sm:w-auto" })} href="/hr/deployments/new">New deployment</Link>;

  if (query.isLoading) return <LoadingState label="Loading deployments…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? rows.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total > rows.length ? `Showing ${rows.length} of ${total} deployments` : total === 1 ? "1 deployment" : `${total} deployments`}</p>
        {newDeploymentLink}
      </div>
      <div className="relative overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Personnel deployments</caption>
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Employee</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Role</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Destination</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Dates</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Status</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => {
              const employee = employeeById.get(row.employee_id);
              return (
                <tr className="border-t" key={row.id}>
                  <td className="px-4 py-3 align-top">
                    {employee ? <><span className="block font-medium">{employee.fullName}</span><span className="block text-muted-foreground tabular-nums">{employee.employeeNumber}</span></> : <span className="text-muted-foreground">{employees.isLoading ? "Loading…" : "Unknown employee"}</span>}
                  </td>
                  <td className="px-4 py-3 align-top">{row.assignment_role}</td>
                  <td className="px-4 py-3 align-top">{[row.location, row.unit, row.project].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">{row.starts_on} – {row.ends_on ?? "ongoing"}</td>
                  <td className="px-4 py-3 align-top"><DeploymentStatusBadge status={row.status} /></td>
                  <td className="px-4 py-3 align-top text-right">
                    <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/hr/deployments/${row.id}`}>
                      View details{" "}<span className="sr-only">for {row.assignment_role}{employee ? `, ${employee.fullName}` : ""}</span>
                    </Link>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={6}>
                  No deployments yet. <Link className="font-medium text-primary underline underline-offset-4" href="/hr/deployments/new">Create the first deployment</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
