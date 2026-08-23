"use client";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrDashboard, useManagementDashboard } from "@/hooks/use-reporting";
import type { DashboardSummary } from "@/schemas/reporting";

type DashboardRole = "hr_personnel" | "management";

function formatMetricName(key: string) {
  return key.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

export function ReportingDashboard({ role }: { role: DashboardRole }) {
  return role === "hr_personnel" ? <HrDashboard /> : <ManagementDashboard />;
}

function HrDashboard() {
  const query = useHrDashboard();
  return <DashboardContent query={query} role="hr_personnel" />;
}

function ManagementDashboard() {
  const query = useManagementDashboard();
  return <DashboardContent query={query} role="management" />;
}

function DashboardContent({ role, query }: { role: DashboardRole; query: { isLoading: boolean; error: Error | null; data: DashboardSummary | undefined } }) {
  if (query.isLoading) return <LoadingState label="Loading workforce analytics…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const data = query.data;
  if (!data) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">No reporting data is available yet.</p>;

  return <section aria-labelledby="page-title" className="space-y-6">
    <div><p className="text-sm font-semibold tracking-wide text-primary uppercase">{role === "management" ? "Management" : "HR Personnel"}</p><h1 id="page-title" className="text-3xl font-semibold tracking-tight">{role === "management" ? "Workforce analytics" : "HR operations dashboard"}</h1><p className="mt-2 text-muted-foreground">Reporting period: {data.range.startsOn} to {data.range.endsOn}.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(data.metrics).map(([key, value]) => <article className="rounded-xl border bg-card p-4" key={key}><p className="text-sm text-muted-foreground">{formatMetricName(key)}</p><p className="mt-2 text-3xl font-semibold">{value}</p></article>)}</div>
    {Object.entries(data.breakdowns).map(([key, rows]) => <section className="overflow-x-auto rounded-xl border" key={key}><table className="w-full min-w-[360px] text-sm" aria-label={formatMetricName(key)}><caption className="p-4 text-left text-base font-semibold">{formatMetricName(key)}</caption><thead className="bg-muted"><tr><th className="p-3 text-left">Status</th><th className="p-3 text-right">Count</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr className="border-t" key={row.label}><td className="p-3">{row.label}</td><td className="p-3 text-right tabular-nums">{row.count}</td></tr>) : <tr><td className="p-3 text-muted-foreground" colSpan={2}>No records in this period.</td></tr>}</tbody></table></section>)}
  </section>;
}
