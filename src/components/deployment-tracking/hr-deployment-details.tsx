"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDeployment } from "@/hooks/use-deployment-tracking";
import { describeDeploymentEvent } from "@/lib/deployment-tracking/history-labels";
import { formatDate, formatDateTime } from "@/lib/format-date";

import { DeploymentStatusBadge } from "./deployment-status-badge";

function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium break-words">{children || <span className="font-normal text-muted-foreground">Not provided</span>}</dd>
    </div>
  );
}

/** Read-only view of one deployment; changes happen on the separate Update page. */
export function HrDeploymentDetails({ deploymentId }: { deploymentId: string }) {
  const detail = useDeployment(deploymentId);
  if (detail.isLoading) return <LoadingState label="Loading deployment…" />;
  if (detail.error || !detail.data) return <ErrorState message={detail.error?.message ?? "Deployment not found."} />;
  const deployment = detail.data;
  const employee = deployment.employee;
  const employeeName = employee ? [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ") : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">Current status <DeploymentStatusBadge deployment={deployment} /></p>
        <Link className={buttonVariants()} href={`/hr/deployments/${deployment.id}/edit`}>Update</Link>
      </div>
      <dl className="grid gap-x-6 gap-y-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Detail label="Employee">{employeeName ? <>{employeeName}<span className="block text-sm font-normal text-muted-foreground tabular-nums">Badge no. {employee?.employee_number}</span></> : null}</Detail>
        <Detail label="Location">{deployment.location}</Detail>
        <Detail label="Deployment type">{deployment.deployment_type}</Detail>
        <Detail label="Event / Operation">{deployment.event_operation}</Detail>
        <Detail label="Start date">{formatDate(deployment.starts_on)}</Detail>
        <Detail label="End date">{formatDate(deployment.ends_on) ?? "One-day deployment"}</Detail>
        <Detail label="Remarks" wide>{deployment.notes}</Detail>
      </dl>
      <section>
        <h2 className="mb-3 text-xl font-bold">History</h2>
        <ol className="space-y-2">
          {deployment.deployment_history.map((event) => (
            <li className="rounded-lg border p-3 text-sm" key={event.id}>
              <p className="font-medium">{describeDeploymentEvent(event, event.actor?.full_name ?? null)}</p>
              <p className="text-muted-foreground">{formatDateTime(event.created_at)}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
