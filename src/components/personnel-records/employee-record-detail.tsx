"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowLeft, Award, BadgeCheck, BookOpenCheck, Building2, Cake, Clock, GraduationCap, History, MapPin, Pencil, ShieldCheck, TrendingUp, UserRound, type LucideIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDepartmentOptions, useRankOptions } from "@/hooks/use-administration";
import { useDeletePersonnelEntry, useEmployee, usePersonnelEntries, useSavePersonnelEntry } from "@/hooks/use-personnel-records";
import { rankLabel } from "@/lib/ranks";
import type { Certification, Qualification, ServiceHistory, TrainingRecord } from "@/lib/types/database";
import type { PersonnelKind } from "@/queries/personnel-records";

import { EmployeeEditor } from "./employee-editor";
import { EmployeeProfilePhotoControl } from "./employee-profile-photo-control";
import { ActivityTimeline, formatDay, InfoCard, ProfileHeaderCard, serviceLength, type TimelineItem } from "./profile-layout";
import { RecordEntryForm } from "./record-entry-form";
import { parseRecordTab, RECORD_TABS, RecordTabs, type RecordTabKey } from "./record-tabs";

const titles: Record<PersonnelKind, string> = { serviceHistory: "Service history", qualification: "Qualifications", certification: "Certifications", training: "Training" };
const icons: Record<PersonnelKind, LucideIcon> = { serviceHistory: History, qualification: GraduationCap, certification: Award, training: BookOpenCheck };
const listItemClassName = "flex flex-col gap-3 rounded-xl border bg-background/60 px-4 py-3 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between";
const emptyItemClassName = "rounded-xl border border-dashed px-4 py-6 text-center text-muted-foreground";

function entryTitle(entry: { id: string } & Record<string, unknown>) {
  if (typeof entry.name === "string") return entry.name;
  if (typeof entry.course_name === "string") return entry.course_name;
  return typeof entry.employment_title === "string" && entry.employment_title ? entry.employment_title : "Service entry";
}

function entryDetail(kind: PersonnelKind, entry: Record<string, unknown>) {
  const parts = kind === "qualification"
    ? [entry.qualification_level, entry.institution, entry.awarded_on]
    : kind === "certification"
      ? [entry.issuer, entry.issued_on && `Issued ${entry.issued_on}`, entry.expires_on && `Expires ${entry.expires_on}`]
      : [entry.started_on && `${entry.started_on} – ${entry.ended_on ?? "present"}`];
  return parts.filter(Boolean).join(" · ");
}

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()) : null;
}

function Records({ employeeId, kind }: { employeeId: string; kind: PersonnelKind }) {
  const entries = usePersonnelEntries(kind, employeeId);
  const save = useSavePersonnelEntry(kind, employeeId);
  const remove = useDeletePersonnelEntry(kind, employeeId);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Service history is the official employment record: it is added to, never deleted.
  const deletable = kind !== "serviceHistory";
  const noun = kind === "qualification" ? "qualification" : "certification";

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : `We could not delete this ${noun}.`);
    }
  }

  if (entries.isLoading) return <LoadingState label={`Loading ${titles[kind].toLowerCase()}…`} />;
  if (entries.error) return <ErrorState message={entries.error.message} />;
  return (
    <InfoCard icon={icons[kind]} id={`records-${kind}`} title={titles[kind]}>
      {kind === "serviceHistory" ? <p className="text-sm text-muted-foreground">Service history is permanent. Add a new entry to record a change.</p> : null}
      <ul className="mt-3 space-y-2">
        {entries.data?.length ? entries.data.map((entry) => {
          const record = entry as unknown as { id: string } & Record<string, unknown>;
          const title = entryTitle(record);
          const detail = entryDetail(kind, record);
          return (
            <li className={listItemClassName} key={entry.id}>
              <div>
                <p className="font-semibold">{title}</p>
                {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
              </div>
              {deletable ? (
                <Button aria-label={`Delete ${noun} ${title}`} onClick={() => { setDeleteError(null); setDeleting({ id: entry.id, title }); }} size="sm" type="button" variant="destructive">Delete</Button>
              ) : null}
            </li>
          );
        }) : <li className={emptyItemClassName}>No {titles[kind].toLowerCase()} recorded.</li>}
      </ul>
      {deleting ? (
        <div aria-labelledby={`delete-${kind}-title`} className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alertdialog">
          <h3 className="font-semibold" id={`delete-${kind}-title`}>Delete this {noun}?</h3>
          <p className="mt-1 text-sm text-muted-foreground">This permanently removes “{deleting.title}” from the employee record. A copy is kept in the record history for auditing. Entries used as promotion evidence cannot be deleted.</p>
          {deleteError ? <p className="mt-2 text-sm font-medium text-destructive" role="alert">{deleteError}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button disabled={remove.isPending} onClick={() => void confirmDelete()} size="sm" type="button" variant="destructive">{remove.isPending ? "Deleting…" : `Delete ${noun}`}</Button>
            <Button disabled={remove.isPending} onClick={() => setDeleting(null)} size="sm" type="button" variant="outline">Cancel</Button>
          </div>
        </div>
      ) : null}
      <RecordEntryForm employeeId={employeeId} kind={kind} onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} />
    </InfoCard>
  );
}

function TrainingRecords({ employeeId }: { employeeId: string }) {
  const [editing, setEditing] = useState<TrainingRecord | null>(null);
  const [deleting, setDeleting] = useState<TrainingRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const entries = usePersonnelEntries("training", employeeId);
  const save = useSavePersonnelEntry("training", employeeId);
  const remove = useDeletePersonnelEntry("training", employeeId);
  const trainings = (entries.data ?? []) as TrainingRecord[];

  async function deleteTraining() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "We could not delete this training record.");
    }
  }

  if (entries.isLoading) return <LoadingState label="Loading training…" />;
  if (entries.error) return <ErrorState message={entries.error.message} />;
  return <InfoCard icon={BookOpenCheck} id="records-training" title="Training">
    <ul className="space-y-2 text-sm">
      {trainings.length ? trainings.map((training) => <li className={listItemClassName} key={training.id}>
        <div><p className="font-semibold">{training.course_name}</p><p className="text-muted-foreground">{training.provider} · {training.completed_on}{training.hours === null ? "" : ` · ${training.hours} hours`}</p></div>
        <div className="flex gap-2"><Button onClick={() => setEditing(training)} size="sm" type="button" variant="outline">Edit</Button><Button onClick={() => { setDeleteError(null); setDeleting(training); }} size="sm" type="button" variant="destructive">Delete</Button></div>
      </li>) : <li className={emptyItemClassName}>No training recorded.</li>}
    </ul>
    {deleting ? <div aria-labelledby="delete-training-title" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="dialog">
      <h3 className="font-medium" id="delete-training-title">Delete training record?</h3><p className="mt-1 text-sm text-muted-foreground">This permanently removes “{deleting.course_name}”.</p>
      {deleteError ? <p className="mt-2 text-sm text-destructive" role="alert">{deleteError}</p> : null}
      <div className="mt-3 flex gap-2"><Button disabled={remove.isPending} onClick={() => void deleteTraining()} size="sm" type="button" variant="destructive">{remove.isPending ? "Deleting…" : "Delete training"}</Button><Button disabled={remove.isPending} onClick={() => setDeleting(null)} size="sm" type="button" variant="outline">Cancel</Button></div>
    </div> : null}
    {editing ? <div className="mt-4"><div className="flex items-center justify-between"><h3 className="font-medium">Edit training</h3><Button onClick={() => setEditing(null)} size="sm" type="button" variant="ghost">Cancel edit</Button></div><RecordEntryForm employeeId={employeeId} key={editing.id} kind="training" onSaved={async (input, id) => { await save.mutateAsync({ id, input: input as never }); setEditing(null); }} pending={save.isPending} training={editing} /></div> : <RecordEntryForm employeeId={employeeId} kind="training" onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} />}
  </InfoCard>;
}

/** Newest personnel entries of every kind, plus per-section counts for the module list. */
function useRecordActivity(employeeId: string, rankTitles: Map<number, string>, departmentNames: Map<number, string>) {
  const service = usePersonnelEntries("serviceHistory", employeeId);
  const qualifications = usePersonnelEntries("qualification", employeeId);
  const certifications = usePersonnelEntries("certification", employeeId);
  const trainings = usePersonnelEntries("training", employeeId);

  const items = useMemo<TimelineItem[]>(() => [
    ...((service.data ?? []) as ServiceHistory[]).map((entry): TimelineItem => ({
      id: `service-${entry.id}`, icon: History, tone: "primary", category: "Service history",
      title: entry.employment_title || (entry.rank_id ? rankTitles.get(entry.rank_id) : undefined) || "Service entry",
      detail: [entry.department_id ? departmentNames.get(entry.department_id) : null, `${formatDay(entry.started_on) ?? entry.started_on} – ${entry.ended_on ? formatDay(entry.ended_on) : "present"}`].filter(Boolean).join(" · "),
      date: entry.started_on,
    })),
    ...((qualifications.data ?? []) as Qualification[]).map((entry): TimelineItem => ({
      id: `qualification-${entry.id}`, icon: GraduationCap, tone: "violet", category: "Qualification",
      title: entry.name, detail: entry.institution, date: entry.awarded_on,
    })),
    ...((certifications.data ?? []) as Certification[]).map((entry): TimelineItem => ({
      id: `certification-${entry.id}`, icon: Award, tone: "amber", category: "Certification",
      title: entry.name, detail: [entry.issuer, entry.expires_on ? `Expires ${formatDay(entry.expires_on)}` : null].filter(Boolean).join(" · "), date: entry.issued_on,
    })),
    ...((trainings.data ?? []) as TrainingRecord[]).map((entry): TimelineItem => ({
      id: `training-${entry.id}`, icon: BookOpenCheck, tone: "emerald", category: "Training",
      title: entry.course_name, detail: [entry.provider, entry.hours === null ? null : `${entry.hours} hours`].filter(Boolean).join(" · "), date: entry.completed_on,
    })),
  ].filter((item) => Boolean(item.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8), [service.data, qualifications.data, certifications.data, trainings.data, rankTitles, departmentNames]);

  return {
    items,
    loading: service.isLoading || qualifications.isLoading || certifications.isLoading || trainings.isLoading,
    counts: {
      "service-history": service.data?.length,
      qualifications: qualifications.data?.length,
      certifications: certifications.data?.length,
      training: trainings.data?.length,
    } satisfies Partial<Record<RecordTabKey, number | undefined>>,
    certificationNames: [...new Set(((certifications.data ?? []) as Certification[]).map((entry) => entry.name))].slice(0, 5),
  };
}

export function EmployeeRecordDetail({ employeeId }: { employeeId: string }) {
  const employee = useEmployee(employeeId);
  const ranks = useRankOptions();
  const departments = useDepartmentOptions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseRecordTab(searchParams.get("tab"));
  const panelsRef = useRef<HTMLDivElement>(null);
  const rankTitles = useMemo(() => new Map((ranks.data ?? []).map((rank) => [rank.id, rankLabel(rank)])), [ranks.data]);
  const departmentNames = useMemo(() => new Map((departments.data ?? []).map((department) => [department.id, department.name])), [departments.data]);
  const activity = useRecordActivity(employeeId, rankTitles, departmentNames);

  function showTab(key: RecordTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function editDetails() {
    showTab("official");
    panelsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  if (employee.isLoading) return <LoadingState label="Loading employee record…" />;
  if (employee.error || !employee.data) return <ErrorState message={employee.error?.message ?? "Employee record was not found."} />;
  const record = employee.data;
  const fullName = [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(" ");
  const rank = record.rank_id ? ranks.data?.find((row) => row.id === record.rank_id) : undefined;
  const panels: Record<RecordTabKey, ReactNode> = {
    official: <InfoCard icon={UserRound} id="records-official" title="Official record"><EmployeeEditor employee={record} /></InfoCard>,
    "service-history": <Records employeeId={employeeId} kind="serviceHistory" />,
    qualifications: <Records employeeId={employeeId} kind="qualification" />,
    certifications: <Records employeeId={employeeId} kind="certification" />,
    training: <TrainingRecords employeeId={employeeId} />,
  };

  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline" href="/hr/employees"><ArrowLeft aria-hidden className="size-4" />Back to employees</Link>
    <ProfileHeaderCard
      actions={<>
        <Button onClick={editDetails} size="sm" type="button"><Pencil aria-hidden />Edit details</Button>
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/hr/promotions/${record.id}`}><TrendingUp aria-hidden />Promotion review</Link>
      </>}
      meta={[
        { label: "Badge number", value: <span className="tabular-nums">{record.employee_number}</span>, icon: BadgeCheck },
        { label: "Status", value: record.employment_status === "on_leave" ? "On leave" : "Active", icon: ShieldCheck },
        { label: "Born", value: formatDay(record.date_of_birth) ?? "Not provided", icon: Cake },
        { label: "Gender", value: titleCase(record.gender) ?? "Not provided", icon: UserRound },
        { label: "Years of service", value: serviceLength(record.employment_started_on, record.employment_ended_on) ?? "Not recorded", icon: Clock },
        { label: "Department", value: (record.department_id ? departmentNames.get(record.department_id) : undefined) ?? "Not assigned", icon: Building2 },
        { label: "Unit / Station", value: record.unit_station || "Not assigned", icon: MapPin },
      ]}
      name={fullName}
      photo={<EmployeeProfilePhotoControl employee={record} />}
      subtitle={rank ? rankLabel(rank) : "Rank not provided"}
      tags={activity.certificationNames}
    />

    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_21rem]">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="lg:rounded-2xl lg:border lg:bg-card lg:p-3 lg:shadow-sm">
          <p className="hidden px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:block">Modules</p>
          <RecordTabs active={active} counts={activity.counts} idPrefix="rec" onChange={showTab} orientation="responsive" />
        </div>
      </aside>
      <div className="min-w-0 scroll-mt-20" ref={panelsRef}>
        {RECORD_TABS.map((tab) => (
          // Every panel stays mounted (hidden when inactive) so unsaved edits survive a tab switch.
          <div aria-labelledby={`rec-tab-${tab.key}`} hidden={tab.key !== active} id={`rec-panel-${tab.key}`} key={tab.key} role="tabpanel">{panels[tab.key]}</div>
        ))}
      </div>
      <InfoCard className="self-start lg:col-start-2 2xl:col-start-3 2xl:row-start-1" icon={Activity} id="recent-activity" title="Recent activity">
        {activity.loading ? <LoadingState label="Loading recent activity…" /> : <ActivityTimeline emptyMessage="No service, qualification, certification, or training entries yet." items={activity.items} />}
      </InfoCard>
    </div>
  </div>;
}
