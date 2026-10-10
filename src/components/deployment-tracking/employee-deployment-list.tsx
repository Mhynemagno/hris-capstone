"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { useMyDeployments } from "@/hooks/use-deployment-tracking";
import { formatDate } from "@/lib/format-date";
import { DeploymentReports } from "./deployment-reports";
import { DeploymentStatusBadge } from "./deployment-status-badge";
export function EmployeeDeploymentList() {
  const [page, setPage] = useState(1);
  const query = useMyDeployments({ page, pageSize: 10 });
  if (query.isLoading) return <LoadingState label="Loading your deployments…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;

  return <section className="space-y-3">{rows.length ? rows.map((row) => <article className="rounded-xl border p-4" key={row.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{row.location || "Deployment"}</p><DeploymentStatusBadge deployment={row} /></div>{row.deployment_type || row.event_operation ? <p className="mt-1 text-sm text-muted-foreground">{[row.deployment_type, row.event_operation].filter(Boolean).join(" · ")}</p> : null}<p className="mt-2 text-sm">{formatDate(row.starts_on)} – {formatDate(row.ends_on) ?? "no end date"}</p>{row.notes ? <p className="mt-2 text-sm"><span className="font-medium">Remarks:</span> {row.notes}</p> : null}<details className="mt-3"><summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">Report / proof of attendance</summary><div className="mt-3"><DeploymentReports deploymentId={row.id} /></div></details></article>) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No deployments recorded.</p>}<Pagination from={rows.length ? (page - 1) * 10 + 1 : 0} noun="deployments" onPageChange={setPage} page={page} pageCount={Math.max(1, Math.ceil(total / 10))} to={Math.min(page * 10, total)} total={total} /></section>;
}
