"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlarmClock,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpenCheck,
  Briefcase,
  CalendarClock,
  CalendarOff,
  ClipboardList,
  FileText,
  MapPin,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPanel } from "@/components/ui/status-panel";
import { useHrDashboard, useManagementDashboard } from "@/hooks/use-reporting";
import { REPORT_KEYS, type DashboardSummary } from "@/schemas/reporting";

import { ChartCard, ColumnTrendChart, DonutChart, HorizontalBarChart, KpiTile, type ChartDatum } from "./charts";
import { REPORT_TITLES } from "./report-detail";

type DashboardRole = "hr_personnel" | "management";

const iconClass = "size-5";

/** Headline tiles in reading order. Keys the RPC does not return are skipped. */
const KPIS: { key: string; label: string; hint: string; icon: ReactNode; tone?: "attention" }[] = [
  { key: "activeWorkforce", label: "Active personnel", hint: "Currently on duty", icon: <UserCheck className={iconClass} /> },
  { key: "totalPersonnel", label: "Total personnel", hint: "All personnel records", icon: <Users className={iconClass} /> },
  { key: "onLeave", label: "On leave", hint: "Employment status on leave", icon: <CalendarOff className={iconClass} /> },
  { key: "attendanceToday", label: "Present today", hint: "Timed in today", icon: <CalendarClock className={iconClass} /> },
  { key: "pendingLeave", label: "Pending leave", hint: "Awaiting a decision", icon: <ClipboardList className={iconClass} />, tone: "attention" },
  { key: "attendanceExceptions", label: "Attendance exceptions", hint: "Late, absent or incomplete", icon: <AlarmClock className={iconClass} />, tone: "attention" },
  { key: "activeDeployments", label: "Active deployments", hint: "Personnel deployed now", icon: <MapPin className={iconClass} /> },
  { key: "openJobs", label: "Open job postings", hint: "Published openings", icon: <Briefcase className={iconClass} /> },
  { key: "recruitmentApplications", label: "Applications received", hint: "In this period", icon: <FileText className={iconClass} /> },
  { key: "hiredApplicants", label: "Applicants hired", hint: "In this period", icon: <UserPlus className={iconClass} /> },
  { key: "promotionReady", label: "Promotion ready", hint: "Evaluated as ready", icon: <Award className={iconClass} /> },
  { key: "trainingNeeds", label: "Training needs", hint: "Missing a requirement", icon: <BookOpenCheck className={iconClass} />, tone: "attention" },
];

/** Display names for metric keys whose generated label reads poorly. */
const metricLabels: Record<string, string> = {
  activeWorkforce: "Active personnel",
  workforceByDepartment: "Personnel by department",
};

function formatMetricName(key: string) {
  if (metricLabels[key]) return metricLabels[key];
  return key.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

function titleCase(label: string) {
  return label.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}

const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
function formatDay(label: string) {
  const date = new Date(`${label}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? label : shortDate.format(date);
}

/** Reserved status colors; every use sits next to a text label. */
const STATUS_COLORS: Record<string, string> = {
  present: "var(--status-good)",
  approved: "var(--status-good)",
  completed: "var(--status-good)",
  ready: "var(--status-good)",
  late: "var(--status-warning)",
  pending: "var(--status-warning)",
  planned: "var(--status-warning)",
  incomplete: "var(--status-serious)",
  "not ready": "var(--status-serious)",
  absent: "var(--status-critical)",
  rejected: "var(--status-critical)",
  cancelled: "var(--status-neutral)",
  active: "var(--chart-1)",
};
const CATEGORICAL = ["var(--chart-1)", "var(--chart-4)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)"];

function statusColor(label: string, index: number) {
  return STATUS_COLORS[label.toLowerCase()] ?? CATEGORICAL[index % CATEGORICAL.length]!;
}

const PIPELINE_ORDER = ["Submitted", "Under Review", "Shortlisted", "Interview", "Needs Revision", "Hired", "Not Selected"];
function byPipeline(rows: ChartDatum[]) {
  const rank = (label: string) => {
    const index = PIPELINE_ORDER.indexOf(label);
    return index === -1 ? PIPELINE_ORDER.length : index;
  };
  return rows.toSorted((left, right) => rank(left.label) - rank(right.label));
}

type ChartSpec = {
  key: string;
  title: string;
  subtitle: string;
  wide?: boolean;
  render: (rows: ChartDatum[]) => ReactNode;
  format?: (label: string) => string;
  labelHeading?: string;
};

const CHARTS: ChartSpec[] = [
  { key: "attendanceTrend", title: "Daily attendance", subtitle: "Personnel who timed in, by day (last 30 days of the period)", wide: true, format: formatDay, labelHeading: "Date", render: (rows) => <ColumnTrendChart data={rows} formatLabel={formatDay} unit="attendance" /> },
  { key: "attendanceStatus", title: "Attendance status", subtitle: "All attendance logs in the period", format: titleCase, labelHeading: "Status", render: (rows) => <DonutChart centerLabel="Logs" colorFor={statusColor} data={rows} formatLabel={titleCase} /> },
  { key: "workforceByDepartment", title: "Personnel by department", subtitle: "Active personnel", labelHeading: "Department", render: (rows) => <HorizontalBarChart data={rows} /> },
  { key: "workforceByRank", title: "Personnel by rank", subtitle: "All personnel, lowest to highest rank", labelHeading: "Rank", render: (rows) => <HorizontalBarChart data={rows} /> },
  { key: "leaveStatus", title: "Leave requests", subtitle: "By status, starting in the period", format: titleCase, labelHeading: "Status", render: (rows) => <DonutChart centerLabel="Requests" colorFor={statusColor} data={rows} formatLabel={titleCase} /> },
  { key: "leaveByType", title: "Leave by type", subtitle: "Requests starting in the period", labelHeading: "Leave type", render: (rows) => <HorizontalBarChart data={rows} /> },
  { key: "recruitmentPipeline", title: "Recruitment pipeline", subtitle: "Applications submitted in the period, by stage", labelHeading: "Stage", render: (rows) => <HorizontalBarChart data={byPipeline(rows)} /> },
  { key: "deploymentStatus", title: "Deployments", subtitle: "All deployments by status", format: titleCase, labelHeading: "Status", render: (rows) => <DonutChart centerLabel="Deployments" colorFor={statusColor} data={rows} formatLabel={titleCase} /> },
  { key: "promotionReadiness", title: "Promotion readiness", subtitle: "Evaluations in the period", labelHeading: "Result", render: (rows) => <DonutChart centerLabel="Evaluated" colorFor={statusColor} data={rows} /> },
  { key: "attendanceLeaveExceptions", title: "Attendance and leave exceptions", subtitle: "Late, absent, incomplete and pending leave", format: titleCase, labelHeading: "Exception", render: (rows) => <HorizontalBarChart colorFor={(label) => statusColor(label, 0)} data={rows} formatLabel={titleCase} /> },
];

const REPORT_DESCRIPTIONS: Record<(typeof REPORT_KEYS)[number], string> = {
  "applicant-tracking": "Every application and its current stage.",
  "hiring-decisions": "Hired and not-selected outcomes.",
  "employee-performance": "Performance ratings by review period.",
  deployments: "Assignments, locations and status.",
  "attendance-leave": "Attendance logs and leave requests.",
  "promotion-training-needs": "Readiness and missing requirements.",
};

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
  if (query.isLoading) return <LoadingState label="Loading personnel analytics…" />;
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

  const knownKpis = new Set(KPIS.map((kpi) => kpi.key));
  const kpis = [
    ...KPIS.filter((kpi) => kpi.key in data.metrics),
    ...Object.keys(data.metrics).filter((key) => !knownKpis.has(key)).map((key) => ({ key, label: formatMetricName(key), hint: "", icon: <BarChart3 className={iconClass} />, tone: undefined })),
  ];
  const knownCharts = new Set(CHARTS.map((chart) => chart.key));
  const charts: ChartSpec[] = [
    ...CHARTS.filter((chart) => chart.key in data.breakdowns),
    ...Object.keys(data.breakdowns).filter((key) => !knownCharts.has(key)).map((key) => ({ key, title: formatMetricName(key), subtitle: "In this period", render: (rows: ChartDatum[]) => <HorizontalBarChart data={rows} /> })),
  ];

  return <section aria-labelledby="page-title" className="space-y-8">
    <PageHeader
      eyebrow={role === "management" ? "Management" : "HR Personnel"}
      id="page-title"
      meta={<p className="text-sm text-muted-foreground">Reporting period: {data.range.startsOn} to {data.range.endsOn}.</p>}
      title={role === "management" ? "Personnel analytics" : "HR operations dashboard"}
    />

    <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {kpis.map((kpi) => <KpiTile hint={kpi.hint || undefined} icon={kpi.icon} key={kpi.key} label={kpi.label} tone={kpi.tone} value={data.metrics[kpi.key] ?? 0} />)}
    </section>

    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {charts.map((chart) => (
        <ChartCard
          className={chart.wide ? "lg:col-span-2" : undefined}
          data={data.breakdowns[chart.key] ?? []}
          formatLabel={chart.format}
          id={chart.key}
          key={chart.key}
          labelHeading={chart.labelHeading}
          subtitle={chart.subtitle}
          title={chart.title}
        >
          {chart.render(data.breakdowns[chart.key] ?? [])}
        </ChartCard>
      ))}
    </div>

    <section aria-labelledby="dashboard-reports" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-semibold" id="dashboard-reports">Detailed reports</h2>
          <p className="text-sm text-muted-foreground">Filter, export to CSV, or print.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" href="/reports">All reports</Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_KEYS.map((reportKey) => (
          <li key={reportKey}>
            <Link className="group flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors duration-200 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/reports/${reportKey}`}>
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className={iconClass} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{REPORT_TITLES[reportKey]}</span>
                <span className="block text-sm text-muted-foreground">{REPORT_DESCRIPTIONS[reportKey]}</span>
              </span>
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  </section>;
}
