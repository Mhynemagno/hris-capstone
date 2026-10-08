"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, FileText, Fingerprint, Plus, TrendingUp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/ui/stat-strip";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useRecentApplications } from "@/hooks/use-recruitment";
import { useHrDashboard, useManagementDashboard } from "@/hooks/use-reporting";
import { useWorkspaceCount } from "@/hooks/use-workspace-counts";
import { attendanceStatusLabel } from "@/lib/attendance-status";
import { formatDate } from "@/lib/format-date";
import { PIPELINE_STAGES } from "@/lib/recruitment/application-stages";
import { resolvePeriod } from "@/lib/workspace/date-range";
import { useListParams } from "@/lib/workspace/list-params";
import type { DashboardSummary } from "@/schemas/reporting";

import { AttentionList, type AttentionItem } from "./attention-list";
import { ChartCard, ColumnTrendChart, formatCount, HorizontalBarChart, type ChartDatum } from "./charts";

type DashboardRole = "hr_personnel" | "management";

const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const formatDay = (label: string) => { const date = new Date(`${label}T00:00:00Z`); return Number.isNaN(date.getTime()) ? label : shortDate.format(date); };

function Panel({ children, id, title, footer }: { id: string; title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col rounded-lg border bg-card">
      <h2 className="border-b px-5 py-3 text-lg font-semibold" id={id}>{title}</h2>
      <div className="flex-1 p-5">{children}</div>
      {footer ? <div className="border-t px-5 py-3 text-sm text-muted-foreground">{footer}</div> : null}
    </section>
  );
}

function PeriodPicker({ preset, startsOn, endsOn, onChange }: { preset: string; startsOn: string; endsOn: string; onChange: (patch: { period?: string; from?: string; to?: string }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect aria-label="Period" className="w-40" onChange={(event) => onChange({ period: event.target.value === "30d" ? "" : event.target.value, from: event.target.value === "custom" ? startsOn : "", to: event.target.value === "custom" ? endsOn : "" })} value={preset}>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="month">This month</option>
        <option value="custom">Custom range</option>
      </NativeSelect>
      {preset === "custom" ? (
        <>
          <Input aria-label="From" className="w-40" max={endsOn} onChange={(event) => onChange({ period: "custom", from: event.target.value, to: endsOn })} type="date" value={startsOn} />
          <Input aria-label="To" className="w-40" min={startsOn} onChange={(event) => onChange({ period: "custom", from: startsOn, to: event.target.value })} type="date" value={endsOn} />
        </>
      ) : null}
    </div>
  );
}

function CreateMenu() {
  const items = [
    { href: "/hr/jobs/new", label: "New job posting" },
    { href: "/hr/employees/new", label: "New employee" },
    { href: "/hr/deployments/new", label: "New deployment" },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button />}><Plus aria-hidden="true" />Create<ChevronDown aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>{item.label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PipelineChart({ rows }: { rows: ChartDatum[] }) {
  const counts = new Map(rows.map((row) => [row.label, row.count]));
  const max = Math.max(1, ...PIPELINE_STAGES.map((stage) => counts.get(stage) ?? 0));
  const notSelected = counts.get("Not Selected") ?? 0;
  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {PIPELINE_STAGES.map((stage) => {
          const count = counts.get(stage) ?? 0;
          return (
            <li key={stage}>
              <Link className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted" href={`/hr/applications?stage=${encodeURIComponent(stage)}`}>
                <span className="truncate text-base">{stage}</span>
                <span aria-hidden="true" className="h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-chart-1" style={{ width: `${count ? Math.max(3, (count / max) * 100) : 0}%` }} /></span>
                <span className="text-right text-base font-semibold tabular-nums">{formatCount(count)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 rounded-md border-t px-2 pt-2.5 pb-1.5 text-muted-foreground hover:bg-muted" href="/hr/applications?quick=not-selected">
        <span className="text-base">Not Selected</span><span /><span className="text-right text-base tabular-nums">{formatCount(notSelected)}</span>
      </Link>
    </div>
  );
}

function StationPulse({ data }: { data: DashboardSummary }) {
  const metric = (key: string) => data.metrics[key] ?? 0;
  const workforce = metric("activeWorkforce");
  const deployed = metric("activeDeployments");
  const present = metric("attendanceToday");
  const onLeave = metric("onLeave");
  const exceptions = "attendanceExceptions" in data.metrics ? metric("attendanceExceptions") : 0;
  const rows = [
    { label: "Present today", count: present, href: "/hr/attendance", color: "bg-emerald-500" },
    { label: "Deployed / outside field", count: deployed, href: "/hr/deployments", color: "bg-amber-500" },
    { label: "Approved leave", count: onLeave, href: "/hr/leave-requests?status=approved", color: "bg-violet-500" },
    { label: "Attendance exceptions", count: exceptions, href: "/hr/attendance", color: "bg-rose-500" },
  ];

  return (
    <Panel footer={<Link className="font-medium text-primary hover:underline" href="/hr/attendance">Go to full attendance roster →</Link>} id="station-pulse-heading" title="Today's station pulse">
      <div className="space-y-4">
        {rows.map((row) => {
          const share = workforce ? Math.min(100, Math.round((row.count / workforce) * 100)) : 0;
          return (
            <Link className="group block rounded-md px-1 py-0.5 transition-colors hover:bg-muted focus-visible:outline-offset-2" href={row.href} key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatCount(row.count)} <span className="font-normal text-muted-foreground">({share}%)</span></span>
              </div>
              <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-muted"><span className={`block h-full rounded-full ${row.color} transition-opacity group-hover:opacity-80`} style={{ width: `${share}%` }} /></span>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <span className="sr-only" role="status">Loading dashboard…</span>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </div>
  );
}

export function WorkspaceDashboard({ role }: { role: DashboardRole }) {
  const isHr = role === "hr_personnel";
  const { params, set } = useListParams(["period", "from", "to"] as const);
  const period = resolvePeriod(params);
  const range = { startsOn: period.startsOn, endsOn: period.endsOn };
  const hrQuery = useHrDashboard(range, isHr);
  const managementQuery = useManagementDashboard(range, !isHr);
  const query = isHr ? hrQuery : managementQuery;
  const awaitingReview = useWorkspaceCount("applicationsAwaitingReview", isHr);
  const unmatched = useWorkspaceCount("unmatchedAttendance", isHr);
  const recent = useRecentApplications(isHr);

  return (
    <PageContainer width="wide">
      <PageHeader
        action={isHr ? <CreateMenu /> : undefined}
        description={`${formatDate(period.startsOn)} to ${formatDate(period.endsOn)}`}
        secondaryActions={<PeriodPicker endsOn={period.endsOn} onChange={(patch) => set(patch)} preset={period.preset} startsOn={period.startsOn} />}
        title="Dashboard"
      />
      {query.isLoading ? <DashboardSkeleton /> : query.error ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : query.data ? (
        <DashboardBody awaitingReview={awaitingReview} data={query.data} isHr={isHr} recent={recent} unmatched={unmatched} />
      ) : null}
    </PageContainer>
  );
}

type CountQuery = { data?: number; isError: boolean };
type RecentQuery = ReturnType<typeof useRecentApplications>;

function DashboardBody({ awaitingReview, data, isHr, recent, unmatched }: { data: DashboardSummary; isHr: boolean; awaitingReview: CountQuery; unmatched: CountQuery; recent: RecentQuery }) {
  const metric = (key: string) => data.metrics[key] ?? 0;
  const countOf = (query: CountQuery) => (query.isError || query.data === undefined ? null : query.data);
  const attention: AttentionItem[] = [
    { key: "applications", label: "Applications awaiting review", count: countOf(awaitingReview), href: "/hr/applications?stage=Application%20Submission", icon: FileText },
    { key: "leave", label: "Leave requests for approval", count: "pendingLeave" in data.metrics ? metric("pendingLeave") : null, href: "/hr/leave-requests?status=pending", icon: CalendarDays },
    { key: "unmatched", label: "Unmatched attendance IDs", count: countOf(unmatched), href: "/hr/attendance/unmatched", icon: Fingerprint },
    { key: "exceptions", label: "Attendance exceptions", count: "attendanceExceptions" in data.metrics ? metric("attendanceExceptions") : null, href: "/hr/attendance", icon: TriangleAlert },
    { key: "promotions", label: "Missing promotion requirements", count: "trainingNeeds" in data.metrics ? metric("trainingNeeds") : null, href: "/hr/promotions", icon: TrendingUp },
  ];
  const workforce = metric("activeWorkforce");
  const onDutyShare = workforce ? Math.round((metric("attendanceToday") / workforce) * 100) : 0;
  const stats = [
    { key: "personnel", label: "Personnel", value: formatCount(metric("totalPersonnel")), href: isHr ? "/hr/employees" : undefined },
    { key: "onDuty", label: "On duty today", value: `${formatCount(metric("attendanceToday"))} / ${formatCount(workforce)}`, hint: `${onDutyShare}% of active personnel`, href: isHr ? "/hr/attendance" : undefined },
    { key: "onLeave", label: "On leave today", value: formatCount(metric("onLeave")), href: isHr ? "/hr/leave-requests?status=approved" : undefined },
    { key: "deployments", label: "Active deployments", value: formatCount(metric("activeDeployments")), href: isHr ? "/hr/deployments" : undefined },
    { key: "openJobs", label: "Open job postings", value: formatCount(metric("openJobs")), href: isHr ? "/hr/jobs?status=published" : undefined },
  ];
  const breakdown = (key: string) => data.breakdowns[key] ?? [];

  return (
    <div className="space-y-6">
      {isHr ? (
        <section aria-labelledby="needs-attention" className="rounded-lg border bg-card">
          <h2 className="border-b px-5 py-3 text-lg font-semibold" id="needs-attention">Needs attention</h2>
          <AttentionList items={attention} />
        </section>
      ) : null}
      <StatStrip items={stats} label="Today" />
      {isHr ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(19rem,0.85fr)]">
            <ChartCard data={breakdown("workforceByDepartment")} id="personnel-distribution" labelHeading="Unit / Section" subtitle="View staffing by unit or section" title="Personnel distribution"><HorizontalBarChart data={breakdown("workforceByDepartment")} /></ChartCard>
            <StationPulse data={data} />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel footer={`${formatCount(metric("hiredApplicants"))} hired in this period`} id="pipeline-heading" title="Recruitment pipeline">
              <PipelineChart rows={breakdown("recruitmentPipeline")} />
            </Panel>
            <Panel id="attendance-heading" title="Attendance">
              <div className="space-y-5">
                {breakdown("attendanceTrend").some((row) => row.count > 0)
                  ? <ColumnTrendChart data={breakdown("attendanceTrend")} formatLabel={formatDay} unit="attendance" />
                  : <p className="grid min-h-32 place-items-center rounded-md border border-dashed text-sm text-muted-foreground">No attendance recorded in this period.</p>}
                {breakdown("attendanceStatus").length ? <HorizontalBarChart data={breakdown("attendanceStatus")} formatLabel={attendanceStatusLabel} /> : null}
              </div>
            </Panel>
            <Panel footer={<Link className="font-medium text-primary hover:underline" href="/hr/applications">View all applications →</Link>} id="recent-heading" title="Recent applications">
              {recent.isLoading ? <Skeleton className="h-32 w-full" /> : recent.error ? <ErrorState message={recent.error.message} /> : recent.data?.length ? (
                <ul className="-my-2 divide-y">
                  {recent.data.map((application) => (
                    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5" key={application.id}>
                      <Link className="min-w-40 flex-1 font-medium hover:underline" href={`/hr/applications/${application.id}`}>{application.applicant_name ?? `Application ${application.id.slice(0, 8)}`}</Link>
                      <span className="min-w-32 text-muted-foreground">{application.job_title ?? "—"}</span>
                      <ApplicationStageBadge status={application.status} />
                      <span className="w-40 text-right text-sm text-muted-foreground tabular-nums">{formatDate(application.submitted_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No applications yet" />}
            </Panel>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel footer={`${formatCount(metric("hiredApplicants"))} hired in this period`} id="pipeline-heading" title="Recruitment pipeline">
              <PipelineChart rows={breakdown("recruitmentPipeline")} />
            </Panel>
            <Panel id="attendance-heading" title="Attendance">
              <div className="space-y-5">
                {breakdown("attendanceTrend").some((row) => row.count > 0)
                  ? <ColumnTrendChart data={breakdown("attendanceTrend")} formatLabel={formatDay} unit="attendance" />
                  : <p className="grid min-h-32 place-items-center rounded-md border border-dashed text-sm text-muted-foreground">No attendance recorded in this period.</p>}
                {breakdown("attendanceStatus").length ? <HorizontalBarChart data={breakdown("attendanceStatus")} formatLabel={attendanceStatusLabel} /> : null}
              </div>
            </Panel>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard data={breakdown("workforceByDepartment")} id="by-unit" labelHeading="Unit / Section" title="Personnel by unit / section"><HorizontalBarChart data={breakdown("workforceByDepartment")} /></ChartCard>
            <ChartCard data={breakdown("workforceByRank")} id="by-rank" labelHeading="Rank" title="Personnel by rank"><HorizontalBarChart data={breakdown("workforceByRank")} /></ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
