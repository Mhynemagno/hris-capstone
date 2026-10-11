"use client";

import { Award, Briefcase, Calendar, Check, MapPinned, Shield, UserCheck, UserRoundSearch, Users, UserX, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { InitialsAvatar, avatarTone } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployeeOptions, useHrDeployments } from "@/hooks/use-deployment-tracking";
import { usePromotionReadiness } from "@/hooks/use-promotion-eligibility";
import { useRecentApplications } from "@/hooks/use-recruitment";
import { useHrDashboard, useHrDashboardOverview } from "@/hooks/use-reporting";
import { formatDate } from "@/lib/format-date";
import { applicationStatusPill, DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";

import { AttendanceDoughnut } from "./attendance-doughnut";
import { DistributionCard } from "./distribution-card";
import { PipelineColumns } from "./pipeline-columns";

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function daysBefore(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const KPI_TONES = {
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  purple: "bg-purple-50 border-purple-200 text-purple-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  rose: "bg-rose-50 border-rose-200 text-rose-700",
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
} as const;

function Kpi({ label, value, caption, captionClassName, icon: Icon, tone }: { label: string; value: ReactNode; caption: ReactNode; captionClassName: string; icon: LucideIcon; tone: keyof typeof KPI_TONES }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${KPI_TONES[tone]}`}>
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className={`text-[10px] font-semibold ${captionClassName}`}>{caption}</p>
      </div>
    </article>
  );
}

function ActivityCard({ id, title, subtitle, href, linkLabel, children }: { id: string; title: string; subtitle: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900" id={id}>{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <Link className="shrink-0 text-xs font-bold text-blue-700 transition-colors hover:text-blue-900" href={href}>{linkLabel} →</Link>
      </div>
      <div className="space-y-3 text-xs">{children}</div>
    </section>
  );
}

const rowClassName = "flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all hover:bg-slate-100/80";

/** HR Dashboard Overview (Capstone UI dashboard.html, PDF pp. 17–19), on live data. */
export function HrDashboardOverview() {
  const today = manilaToday();
  const summary = useHrDashboard({ startsOn: daysBefore(today, 29), endsOn: today });
  const overview = useHrDashboardOverview();
  const readiness = usePromotionReadiness();
  const recentApplications = useRecentApplications();
  const deployments = useHrDeployments({ page: 1, pageSize: 5 });
  const employees = useEmployeeOptions();

  const attendance = overview.data?.attendanceToday;
  const activeTotal = (overview.data?.personnelByGender ?? []).reduce((sum, item) => sum + item.count, 0);
  const present = attendance?.present ?? 0;
  const absent = (attendance?.absent ?? 0) + (attendance?.onLeave ?? 0);
  const partial = (attendance?.late ?? 0) + (attendance?.incomplete ?? 0);
  const strength = activeTotal ? ((present / activeTotal) * 100).toFixed(1) : "0.0";
  const readyCount = (readiness.data ?? []).filter((row) => row.readiness?.isReady).length;
  const quarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const employeeNames = new Map((employees.data ?? []).map((employee) => [employee.id, employee.fullName]));

  return (
    <div className="space-y-6">
      <PageTitle
        actions={(
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            <Calendar aria-hidden="true" className="size-3.5 text-slate-500" />
            <span>Last 30 days</span>
          </div>
        )}
        subtitle={<>Real-time manpower analytics, daily attendance, and deployment status for <span className="font-bold text-slate-700">{formatDate(today)}</span>.</>}
        title="Dashboard Overview"
      />

      {overview.error ? <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi caption={<><Check aria-hidden="true" className="inline size-3" /> Active personnel</>} captionClassName="text-emerald-700" icon={Users} label="Total Active 201" tone="blue" value={activeTotal} />
        <Kpi caption={`${strength}% Operational Strength`} captionClassName="text-purple-700" icon={UserCheck} label="Present On Duty" tone="purple" value={<>{present}<span className="text-xs font-normal text-slate-500">/ {activeTotal}</span></>} />
        <Kpi caption="Approved Leave Status" captionClassName="text-amber-700" icon={UserX} label="Absent / Leave" tone="amber" value={absent} />
        <Kpi caption="Half-day / Late Check-in" captionClassName="text-rose-600" icon={UserRoundSearch} label="Partial / Late" tone="rose" value={partial} />
        <Kpi caption="Open for Recruitment" captionClassName="text-indigo-600" icon={Briefcase} label="Plantilla Vacancies" tone="indigo" value={summary.data?.metrics.openJobs ?? 0} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {summary.isLoading ? <LoadingState label="Loading dashboard…" /> : summary.error ? <ErrorState message={summary.error.message} onRetry={() => void summary.refetch()} /> : (
            <>
              <DistributionCard overview={overview.data} units={summary.data?.breakdowns.workforceByDepartment ?? []} />
              <PipelineColumns rows={summary.data?.breakdowns.recruitmentPipeline ?? []} />
            </>
          )}
        </div>
        <div className="space-y-6 lg:col-span-4">
          <AttendanceDoughnut absent={absent} partial={partial} present={present} total={activeTotal} />
          {readyCount > 0 ? (
            <section aria-labelledby="promotion-notice-heading" className="space-y-3 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-blue-950 p-6 text-white shadow-md">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-amber-400/30 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">Promotion Notice</span>
                <Award aria-hidden="true" className="size-5 text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white" id="promotion-notice-heading">Q{quarter} Promotion Endorsement</h3>
              <p className="text-xs leading-relaxed text-slate-300">{readyCount} personnel meet the criteria for regular promotion evaluation.</p>
              <Link className="block w-full rounded-xl bg-amber-500 py-2 text-center text-xs font-bold text-slate-950 transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" href="/hr/promotions">
                Review Endorsements
              </Link>
            </section>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-2">
        <ActivityCard href="/hr/applications" id="recent-applications-heading" linkLabel="View All Applications" subtitle="Latest applicant submissions & activity logs" title="Recent Applications">
          {recentApplications.isLoading ? <LoadingState label="Loading applications…" /> : recentApplications.error ? <ErrorState message={recentApplications.error.message} /> : (recentApplications.data ?? []).length ? (recentApplications.data ?? []).map((application) => {
            const name = application.applicant_name ?? "Applicant";
            const pill = applicationStatusPill(application.status);
            return (
              <div className={rowClassName} key={application.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <InitialsAvatar name={name} tone={avatarTone(name)} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{name}</p>
                    <p className="truncate text-[10px] text-slate-500">{application.job_title ?? "Recruitment"} • {formatDate(application.submitted_at)}</p>
                  </div>
                </div>
                <StatusPill className="normal-case tracking-normal" tone={pill.tone}>{pill.label}</StatusPill>
              </div>
            );
          }) : <p className="text-xs text-slate-500">No recent applications.</p>}
        </ActivityCard>

        <ActivityCard href="/hr/deployments" id="recent-deployments-heading" linkLabel="View Full Roster" subtitle="Latest field assignments & tactical duty logs" title="Recent Duty Deployments">
          {deployments.isLoading ? <LoadingState label="Loading deployments…" /> : deployments.error ? <ErrorState message={deployments.error.message} /> : (deployments.data?.rows ?? []).length ? (deployments.data?.rows ?? []).map((deployment) => {
            const ongoing = deployment.status === "ongoing";
            const Icon = ongoing ? MapPinned : Shield;
            const status = DEPLOYMENT_STATUS[deployment.status];
            return (
              <div className={rowClassName} key={deployment.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${ongoing ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-slate-300 bg-slate-200 text-slate-700"}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{employeeNames.get(deployment.employee_id) ?? "Personnel"}</p>
                    <p className="truncate text-[10px] text-slate-500">{deployment.deployment_type ?? "Deployment"} • {deployment.location ?? "No location"}</p>
                  </div>
                </div>
                <StatusPill className="normal-case tracking-normal" tone={status.tone}>{status.label}</StatusPill>
              </div>
            );
          }) : <p className="text-xs text-slate-500">No recent deployments.</p>}
        </ActivityCard>
      </div>
    </div>
  );
}
