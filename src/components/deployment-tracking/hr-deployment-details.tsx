"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCancelDeployment, useDeployment, useReviewDeploymentStatus } from "@/hooks/use-deployment-tracking";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { deploymentEmployeeName } from "@/queries/deployment-tracking";

import { DeploymentReports } from "./deployment-reports";
import { DeploymentStatusBadge, deploymentStatusLabels } from "./deployment-status-badge";

function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium break-words">{children || <span className="font-normal text-muted-foreground">Not provided</span>}</dd>
    </div>
  );
}

/**
 * Read-only view of one employee's deployment. HR approves or rejects the status the employee
 * proposed with proof, and can cancel; the details themselves change in the Edit panel.
 */
export function HrDeploymentDetails({ deploymentId }: { deploymentId: string }) {
  const detail = useDeployment(deploymentId);
  const review = useReviewDeploymentStatus();
  const cancel = useCancelDeployment();
  if (detail.isLoading) return <LoadingState label="Loading deployment…" />;
  if (detail.error || !detail.data) return <ErrorState message={detail.error?.message ?? "Deployment not found."} />;
  const deployment = detail.data;
  const employee = deployment.employee;
  const employeeName = deploymentEmployeeName(employee);
  const open = deployment.status === "scheduled" || deployment.status === "ongoing";
  const busy = review.isPending || cancel.isPending;

  async function decide(approve: boolean) {
    try {
      await review.mutateAsync({ id: deployment.id, approve });
      notifyStaff({ title: approve ? "Status update approved" : "Status update rejected" });
    } catch (error) {
      notifyStaff({ title: "Could not review the status update", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function cancelDeployment() {
    if (!window.confirm("Cancel this deployment?")) return;
    try {
      await cancel.mutateAsync({ id: deployment.id, expectedUpdatedAt: deployment.updated_at });
      notifyStaff({ title: "Deployment cancelled" });
    } catch (error) {
      notifyStaff({ title: "Could not cancel deployment", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">Current status <DeploymentStatusBadge deployment={deployment} /></p>
        <div className="flex flex-wrap gap-2">
          {open ? <Button disabled={busy} onClick={() => void cancelDeployment()} type="button" variant="outline">Cancel deployment</Button> : null}
          <Link className={buttonVariants()} href={`/hr/deployments?edit=${deployment.id}`}>Update</Link>
        </div>
      </div>
      {deployment.proposed_status ? (
        <div aria-label="Status update for approval" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4" role="region">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">For approval:</span> the employee marked this deployment as <span className="font-semibold">{deploymentStatusLabels[deployment.proposed_status]}</span>
            {deployment.proposed_at ? <> on {formatDateTime(deployment.proposed_at)}</> : null}. Check the submitted proof below.
          </p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void decide(false)} type="button" variant="outline">Reject</Button>
            <Button disabled={busy} onClick={() => void decide(true)} type="button">Approve</Button>
          </div>
        </div>
      ) : null}
      <dl className="grid gap-x-6 gap-y-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Detail label="Employee">{employeeName ? <>{employee?.rank?.code ? `${employee.rank.code} ` : ""}{employeeName}<span className="block text-sm font-normal text-muted-foreground tabular-nums">Badge no. {employee?.employee_number}</span></> : null}</Detail>
        <Detail label="Task">{deployment.task}</Detail>
        <Detail label="Location">{deployment.location}</Detail>
        <Detail label="Deployment type">{deployment.deployment_type}</Detail>
        <Detail label="Event / Operation">{deployment.event_operation}</Detail>
        <Detail label="Start date">{formatDate(deployment.starts_on)}</Detail>
        <Detail label="End date">{formatDate(deployment.ends_on) ?? "One-day deployment"}</Detail>
      </dl>
      <DeploymentReports canSubmit={false} deploymentId={deployment.id} />
    </section>
  );
}
