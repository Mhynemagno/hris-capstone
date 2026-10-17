"use client";

import { Building2, CalendarCheck, Camera, CircleCheck, CircleDashed, MapPin, MapPinned } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { serviceLength } from "@/components/personnel-records/profile-layout";
import { avatarTone, initialsOf } from "@/components/staff-shell/ui/initials-avatar";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { StatusPill } from "@/components/staff-shell/ui/status-pill";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDepartmentOptions, useRankOptions } from "@/hooks/use-administration";
import { useMyAttendanceLogs } from "@/hooks/use-attendance-integration";
import { useMyDeployments } from "@/hooks/use-deployment-tracking";
import { useLeaveTypes, useMyLeaveBalances } from "@/hooks/use-leave-management";
import { useEmployeeForCurrentUser, useEmployeeProfilePhotoUrl, useRequestEmployeeRecordAssistance } from "@/hooks/use-personnel-records";
import { useMyPromotionEligibility } from "@/hooks/use-promotion-eligibility";
import { usePublishedAnnouncements } from "@/hooks/use-public-site";
import { formatDate, formatDateRange } from "@/lib/format-date";
import { LEAVE_TONE_CLASSES, leaveTypeStyle } from "@/lib/leave-management/leave-type-style";
import { rankLabel } from "@/lib/ranks";
import { DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";
import type { Deployment } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { announcementCategoryLabel } from "@/schemas/public-site";

const MANILA = "Asia/Manila";
const manilaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: MANILA }).format(new Date());
const clock = (value: string | null) => (value ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MANILA }).format(new Date(value)) : "--:--");

const CATEGORY_TONE: Record<string, string> = {
  news: "border-blue-200/80 bg-blue-50/60 text-blue-700",
  advisory: "border-amber-200/80 bg-amber-50/60 text-amber-700",
  event: "border-emerald-200/80 bg-emerald-50/60 text-emerald-700",
  recruitment: "border-purple-200/80 bg-purple-50/60 text-purple-700",
};

function Card({ id, title, subtitle, icon, aside, children }: { id: string; title: string; subtitle?: string; icon?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <h2 className="text-sm font-bold text-slate-900" id={id}>{title}</h2>
            {subtitle ? <p className="text-[11px] text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

const linkClass = "text-[11px] font-bold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function currentAssignment(rows: Deployment[]) {
  const ongoing = rows.find((row) => row.status === "ongoing");
  if (ongoing) return ongoing;
  return rows.filter((row) => row.status === "scheduled").sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null;
}

/** Personnel Dashboard (Capstone UI empdash.html, PDF p. 39): only the signed-in employee's own live data. */
export function EmployeeDashboard() {
  const employee = useEmployeeForCurrentUser();
  const ranks = useRankOptions();
  const departments = useDepartmentOptions();
  const deployments = useMyDeployments({ pageSize: 100 });
  const today = manilaToday();
  const balances = useMyLeaveBalances(Number(today.slice(0, 4)));
  const leaveTypes = useLeaveTypes({ pageSize: 100 });
  const attendance = useMyAttendanceLogs({ startsOn: today, endsOn: today, pageSize: 1 });
  const photo = useEmployeeProfilePhotoUrl(employee.data?.profile_image_path ?? null);
  const promotion = useMyPromotionEligibility();
  const announcements = usePublishedAnnouncements(3);
  const recordAssistance = useRequestEmployeeRecordAssistance();
  const [recordAssistanceMessage, setRecordAssistanceMessage] = useState<string | null>(null);

  if (employee.isLoading) return <LoadingState label="Loading your dashboard…" />;
  if (employee.error) return <ErrorState message={employee.error.message} />;
  const record = employee.data;
  if (!record) {
    return (
      <div className="space-y-6">
        <PageTitle subtitle="Your live personnel overview." title="Personnel Dashboard" />
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <p>Your official personnel record has not been linked to this account yet. Contact HR for help.</p>
          <Button disabled={recordAssistance.isPending} onClick={() => {
            setRecordAssistanceMessage(null);
            void recordAssistance.mutateAsync().then(() => setRecordAssistanceMessage("HR has been notified to help link your record.")).catch((cause: unknown) => setRecordAssistanceMessage(cause instanceof Error ? cause.message : "Unable to notify HR right now."));
          }} type="button" variant="outline">
            {recordAssistance.isPending ? "Contacting HR…" : "Contact HR"}
          </Button>
          {recordAssistanceMessage ? <p role="status">{recordAssistanceMessage}</p> : null}
        </section>
      </div>
    );
  }

  const name = [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(" ");
  const rank = record.rank_id ? ranks.data?.find((row) => row.id === record.rank_id) : undefined;
  const rankText = !record.rank_id ? "Rank not provided" : ranks.error ? "Rank unavailable" : rank ? rankLabel(rank) : ranks.isLoading ? "Loading rank…" : "Rank not provided";
  const department = record.department_id ? departments.data?.find((row) => row.id === record.department_id) : undefined;
  const active = record.employment_status === "active";
  const assignment = currentAssignment(deployments.data?.rows ?? []);
  const pill = assignment ? DEPLOYMENT_STATUS[assignment.status] : null;
  const log = attendance.data?.rows[0];
  const readiness = promotion.data;
  const requirements = readiness?.readiness.requirements ?? [];
  const met = requirements.filter((row) => row.met).length;
  const percent = requirements.length ? Math.round((met / requirements.length) * 100) : readiness?.readiness.isReady ? 100 : 0;
  const typeById = new Map((leaveTypes.data?.rows ?? []).map((type) => [type.id, type]));
  const entitlements = (balances.data ?? []).flatMap((balance) => {
    const type = typeById.get(balance.leave_type_id);
    return type && (!type.eligible_gender || type.eligible_gender === record.gender) ? [{ balance, type }] : [];
  }).slice(0, 4);
  const stats: [string, string, string][] = [
    ["Badge Number", record.employee_number, "font-mono text-amber-300"],
    ["Years of Service", serviceLength(record.employment_started_on, record.employment_ended_on) ?? "Not recorded", "text-white"],
    ["Station Sector", record.unit_station || "Not assigned", "text-white"],
    ["Promotion Status", promotion.isLoading ? "Loading…" : promotion.error ? "Unavailable" : readiness ? `${readiness.targetRankCode} ${readiness.docket ? "Submitted" : readiness.readiness.isReady ? "Eligible" : "In progress"}` : "No active criterion", readiness?.readiness.isReady ? "text-emerald-400" : "text-white"],
  ];

  return (
    <div className="space-y-6">
      <PageTitle subtitle="Your live personnel overview." title="Personnel Dashboard" />

      <section aria-label="Officer profile" className="relative overflow-hidden rounded-2xl border border-slate-800 bg-linear-to-r from-[#0B132B] via-slate-900 to-blue-950 p-6 text-white shadow-lg">
        <div className="flex items-center gap-5">
          {photo.data ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL of the employee's own uploaded photo
            <img alt="" className="size-16 shrink-0 rounded-2xl border-2 border-amber-300/50 object-cover shadow-md" src={photo.data} />
          ) : (
            <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-300/50 bg-linear-to-tr from-amber-400 to-amber-200 text-xl font-black text-slate-950 shadow-md" data-testid="profile-initials" data-tone={avatarTone(name)}>{initialsOf(`${record.first_name} ${record.last_name}`)}</span>
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-black tracking-tight text-white">{name}</h2>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase", active ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300" : "border-slate-400/40 bg-slate-500/20 text-slate-300")}>{record.employment_status.charAt(0).toUpperCase() + record.employment_status.slice(1)}</span>
            </div>
            <p className="text-xs font-bold tracking-wide text-amber-400">{rankText}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-300"><Building2 aria-hidden="true" className="size-3.5 text-blue-400" />{department?.name ?? (record.department_id ? (departments.error ? "Unit unavailable" : "Loading unit…") : "Unit not assigned")}</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-800 pt-6 text-xs sm:grid-cols-4">
          {stats.map(([label, value, tone]) => (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3" key={label}>
              <dt className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</dt>
              <dd className={cn("mt-0.5 truncate text-sm font-bold", tone)}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card aside={pill ? <StatusPill tone={pill.tone}>{pill.label}</StatusPill> : null} icon={<span className="flex size-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"><MapPinned aria-hidden="true" className="size-4" /></span>} id="assignment-heading" subtitle="Active duty assignment details" title="Current Field Assignment">
            {deployments.isLoading ? <LoadingState label="Loading your assignment…" /> : deployments.error ? <ErrorState message={deployments.error.message} /> : assignment ? (
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-base font-black text-slate-900">{assignment.project || assignment.location || "Field assignment"}</p>
                    {assignment.location ? <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" className="size-3.5 text-rose-500" />{assignment.location}</p> : null}
                  </div>
                  <div className="sm:text-right">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Operation Type</span>
                    <span className="text-xs font-bold text-slate-800">{[assignment.deployment_type, assignment.event_operation].filter(Boolean).join(" / ") || "Not specified"}</span>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-2 border-t border-slate-200/60 pt-3 text-xs sm:grid-cols-2">
                  <div><dt className="text-[10px] font-semibold text-slate-500">Assignment Period</dt><dd className="font-bold text-slate-800">{formatDateRange(assignment.starts_on, assignment.ends_on)}</dd></div>
                  <div><dt className="text-[10px] font-semibold text-slate-500">Tactical Unit</dt><dd className="font-bold text-slate-800">{assignment.unit || "Not specified"}</dd></div>
                </dl>
              </div>
            ) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500" role="status">No current field assignment</p>}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card aside={log ? <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{log.capture_method === "face_recognition" ? "Face scan" : "Imported"}</span> : null} id="attendance-heading" title="Today's Attendance">
              {attendance.isLoading ? <LoadingState label="Loading today's attendance…" /> : attendance.error ? <ErrorState message={attendance.error.message} /> : log ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
                  <div><span className="block text-[10px] font-extrabold text-emerald-800 uppercase">Time In</span><span className="font-mono text-lg font-black text-emerald-950">{clock(log.time_in)}</span></div>
                  <div className="text-right"><span className="block text-[10px] font-extrabold text-slate-500 uppercase">Time Out</span><span className="font-mono text-lg font-black text-slate-800">{clock(log.time_out)}</span></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500" role="status"><Camera aria-hidden="true" className="size-4" />Not yet recorded today</p>
                  <Link className={linkClass} href="/employee/attendance">Open Attendance</Link>
                </div>
              )}
              <p className="text-[10px] text-slate-500">{formatDate(today)}</p>
            </Card>

            <Card aside={readiness ? <span className="font-mono text-[10px] font-bold text-blue-700">{percent}% requirements met</span> : null} id="promotion-heading" title="Promotion Board Status">
              {promotion.isLoading ? <LoadingState label="Loading promotion status…" /> : promotion.error ? <ErrorState message={promotion.error.message} /> : readiness ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-700">Target rank: {readiness.targetRankCode}</span>
                    {readiness.readiness.isReady
                      ? <span className="flex items-center gap-1 text-emerald-700"><CircleCheck aria-hidden="true" className="size-3.5" />Eligible</span>
                      : <span className="flex items-center gap-1 text-amber-700"><CircleDashed aria-hidden="true" className="size-3.5" />In progress</span>}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-0.5"><div className={cn("h-full rounded-full", readiness.readiness.isReady ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${percent}%` }} /></div>
                  <p className="text-[10px] text-slate-500">{readiness.docket ? "Your docket has been submitted to the Promotion Board." : readiness.readiness.isReady ? "All criteria for your next rank are met." : `${readiness.readiness.missingRequirements.length} requirement(s) still missing.`}</p>
                </div>
              ) : <p className="text-[11px] text-slate-500" role="status">No active promotion criterion applies to your current rank yet.</p>}
              <Link className={linkClass} href="/employee/promotion-eligibility">View Promotion Status</Link>
            </Card>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card aside={<Link className={linkClass} href="/employee/leave?request=1">File Leave</Link>} icon={<CalendarCheck aria-hidden="true" className="size-4 text-blue-700" />} id="leave-heading" title="Leave Entitlements">
            {balances.isLoading || leaveTypes.isLoading ? <LoadingState label="Loading leave entitlements…" /> : balances.error || leaveTypes.error ? <ErrorState message={(balances.error ?? leaveTypes.error)!.message} /> : entitlements.length ? (
              <ul className="space-y-2.5">
                {entitlements.map(({ balance, type }) => {
                  const style = leaveTypeStyle(type.name);
                  const remaining = balance.days_per_year === null ? null : Math.max(balance.days_per_year - balance.used_days, 0);
                  return (
                    <li className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3" key={balance.leave_type_id}>
                      <div className="flex items-center gap-2.5">
                        <span className={cn("flex size-7 items-center justify-center rounded-lg border", LEAVE_TONE_CLASSES[style.tone])}><style.Icon aria-hidden="true" className="size-3.5" /></span>
                        <div><p className="text-xs font-bold text-slate-900">{type.name}</p><p className="text-[10px] text-slate-500">{balance.days_per_year === null ? "No yearly limit" : `${balance.days_per_year} Days / Year`}</p></div>
                      </div>
                      <span className="font-mono text-base font-black text-slate-900">{remaining === null ? "—" : `${remaining}d`}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-xs text-slate-500" role="status">No leave entitlements are available yet.</p>}
          </Card>

          <Card id="announcements-heading" title="Announcements">
            {announcements.isLoading ? <LoadingState label="Loading announcements…" /> : announcements.error ? <ErrorState message={announcements.error.message} /> : (announcements.data ?? []).length ? (
              <ul className="space-y-3 text-xs">
                {(announcements.data ?? []).map((item) => (
                  <li className={cn("rounded-xl border", CATEGORY_TONE[item.category] ?? "border-slate-200/80 bg-slate-50 text-slate-600")} key={item.id}>
                    <Link aria-label={`View details for ${item.title}`} className="block space-y-1 rounded-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" href={`/announcements/${item.id}`}>
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">{announcementCategoryLabel(item.category)}</span>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-[11px] text-slate-600">{item.summary}</p>
                    {item.published_at ? <p className="text-[10px] text-slate-500">{formatDate(item.published_at)}</p> : null}
                    <span className="block text-[11px] font-bold text-blue-700">View details</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-slate-500" role="status">No announcements right now.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
