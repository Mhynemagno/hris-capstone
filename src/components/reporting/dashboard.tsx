"use client";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPanel } from "@/components/ui/status-panel";
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
  if (!data) {
    return (
      <StatusPanel
        description="Try again after reporting data has been generated for this period."
        kind="empty"
        title="No reporting data is available yet"
      />
    );
  }

  return <section aria-labelledby="page-title" className="space-y-6">
    <PageHeader eyebrow={role === "management" ? "Management" : "HR Personnel"} id="page-title" meta={<p className="text-sm text-muted-foreground">Reporting period: {data.range.startsOn} to {data.range.endsOn}.</p>} title={role === "management" ? "Workforce analytics" : "HR operations dashboard"} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(data.metrics).map(([key, value]) => <MetricCard key={key} label={formatMetricName(key)} value={value} />)}</div>
    {Object.entries(data.breakdowns).map(([key, rows]) => <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm" key={key}><table className="w-full min-w-[360px] text-sm" aria-label={formatMetricName(key)}><caption className="p-5 text-left text-base font-semibold">{formatMetricName(key)}</caption><thead className="bg-muted/70"><tr><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-right">Count</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr className="border-t" key={row.label}><td className="px-5 py-3">{row.label}</td><td className="px-5 py-3 text-right tabular-nums">{row.count}</td></tr>) : <tr><td className="px-5 py-6 text-muted-foreground" colSpan={2}>No records in this period.</td></tr>}</tbody></table></section>)}
  </section>;
}
