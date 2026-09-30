"use client";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyDeployments } from "@/hooks/use-deployment-tracking";
import { formatDate } from "@/lib/format-date";
import { DeploymentStatusBadge, effectiveDeploymentStatus, manilaToday } from "./deployment-status-badge";
export function EmployeeDeploymentList() { const query = useMyDeployments({ page: 1, pageSize: 25 }); if (query.isLoading) return <LoadingState label="Loading your deployments…" />; if (query.error) return <ErrorState message={query.error.message} />; const rows = query.data?.rows ?? []; const today = manilaToday(); return <section className="space-y-3">{rows.length ? rows.map((row) => <article className="rounded-xl border p-4" key={row.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{row.location || "Deployment"}</p><DeploymentStatusBadge deployment={row} today={today} /></div><p className="mt-2 text-sm">{formatDate(row.starts_on)} – {formatDate(row.ends_on) ?? (effectiveDeploymentStatus(row, today) === "upcoming" ? "no end date" : "ongoing")}</p>{row.notes ? <p className="mt-2 text-sm"><span className="font-medium">Remarks:</span> {row.notes}</p> : null}</article>) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No deployments recorded.</p>}</section>; }
