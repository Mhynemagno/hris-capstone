"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowLeft, Award, BadgeCheck, BookOpenCheck, Building2, Cake, CheckCircle2, Clock, GraduationCap, History, MapPin, Pencil, ShieldCheck, TrendingUp, UserRound, X, type LucideIcon } from "lucide-react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDepartmentOptions, useRankOptions } from "@/hooks/use-administration";
import { useEmployee, usePersonnelEntries, useSavePersonnelEntry } from "@/hooks/use-personnel-records";
import { formatDate, formatDateRange } from "@/lib/format-date";
import { rankLabel } from "@/lib/ranks";
import type { Certification, Employee, Qualification, ServiceHistory, TrainingRecord } from "@/lib/types/database";
import type { DeletableEntityType } from "@/queries/deletion";
import type { PersonnelKind } from "@/queries/personnel-records";

import { EmployeeEditor } from "./employee-editor";
import { EmployeeProfilePhotoControl } from "./employee-profile-photo-control";
import { ActivityTimeline, formatDay, InfoCard, ProfileHeaderCard, serviceLength, type TimelineItem } from "./profile-layout";
import { RecordEntryForm } from "./record-entry-form";
import { parseRecordTab, RECORD_TABS, RecordTabs, type RecordTabKey } from "./record-tabs";

/** Lower-case nouns for delete prompts, and the server-side record type each kind deletes as. */
const nouns: Record<PersonnelKind, string> = { serviceHistory: "service history entry", qualification: "eligibility", certification: "certification / training", training: "training record" };
const deletionTypes: Record<PersonnelKind, DeletableEntityType> = { serviceHistory: "service_history", qualification: "qualification", certification: "certification", training: "training_record" };
const titles: Record<PersonnelKind, string> = { serviceHistory: "Service history", qualification: "Eligibility", certification: "Certification / Training", training: "Training" };
const icons: Record<PersonnelKind, LucideIcon> = { serviceHistory: History, qualification: GraduationCap, certification: Award, training: BookOpenCheck };
const listItemClassName = "flex flex-col gap-3 rounded-xl border bg-background/60 px-4 py-3 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between";
const emptyItemClassName = "rounded-xl border border-dashed px-4 py-6 text-center text-muted-foreground";

function entryTitle(entry: { id: string } & Record<string, unknown>) {
  if (typeof entry.name === "string") return entry.name;
  if (typeof entry.course_name === "string") return entry.course_name;
  return typeof entry.employment_title === "string" && entry.employment_title ? entry.employment_title : "Service entry";
}

function day(value: unknown) {
  return typeof value === "string" ? formatDate(value) : null;
}

function entryDetail(kind: PersonnelKind, entry: Record<string, unknown>) {
  const parts = kind === "qualification"
    ? [day(entry.awarded_on), entry.notes]
    : kind === "certification"
      ? [entry.issued_on && `Completed ${day(entry.issued_on)}`, entry.notes]
      : [typeof entry.started_on === "string" && entry.started_on && formatDateRange(entry.started_on, typeof entry.ended_on === "string" ? entry.ended_on : null)];
  return parts.filter(Boolean).join(" · ");
}

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()) : null;
}

/** `editable` is false in view mode: the list is shown without add, edit, or delete controls. */
function Records({ employeeId, kind, editable }: { employeeId: string; kind: PersonnelKind; editable: boolean }) {
  const entries = usePersonnelEntries(kind, employeeId);
  const save = useSavePersonnelEntry(kind, employeeId);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noun = nouns[kind];

  if (entries.isLoading) return <LoadingState label={`Loading ${titles[kind].toLowerCase()}…`} />;
  if (entries.error) return <ErrorState message={entries.error.message} />;
  return (
    <InfoCard icon={icons[kind]} id={`records-${kind}`} title={titles[kind]}>
      {notice ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice}</p> : null}
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
              {editable ? (
                <Button aria-label={`Delete ${noun} ${title}`} onClick={() => { setNotice(null); setDeleting(entry.id); }} size="sm" type="button" variant="destructive">Delete</Button>
              ) : null}
            </li>
          );
        }) : <li className={emptyItemClassName}>No {titles[kind].toLowerCase()} recorded.</li>}
      </ul>
      <DeleteRecordDialog
        entityId={deleting}
        entityType={deletionTypes[kind]}
        noun={noun}
        onClose={() => setDeleting(null)}
        onDeleted={() => setNotice(`The ${noun} was deleted successfully.`)}
      />
      {editable ? <RecordEntryForm employeeId={employeeId} kind={kind} onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} /> : null}
    </InfoCard>
  );
}

function TrainingRecords({ employeeId, editable }: { employeeId: string; editable: boolean }) {
  const [editing, setEditing] = useState<TrainingRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const entries = usePersonnelEntries("training", employeeId);
  const save = useSavePersonnelEntry("training", employeeId);
  const trainings = (entries.data ?? []) as TrainingRecord[];

  if (entries.isLoading) return <LoadingState label="Loading training…" />;
  if (entries.error) return <ErrorState message={entries.error.message} />;
  return <InfoCard icon={BookOpenCheck} id="records-training" title="Training">
    <ul className="space-y-2 text-sm">
      {trainings.length ? trainings.map((training) => <li className={listItemClassName} key={training.id}>
        <div><p className="font-semibold">{training.course_name}</p><p className="text-muted-foreground">{training.provider} · {formatDate(training.completed_on)}{training.hours === null ? "" : ` · ${training.hours} hours`}</p></div>
        {editable ? <div className="flex gap-2"><Button onClick={() => setEditing(training)} size="sm" type="button" variant="outline">Edit</Button><Button aria-label={`Delete training record ${training.course_name}`} onClick={() => { setNotice(null); setDeleting(training.id); }} size="sm" type="button" variant="destructive">Delete</Button></div> : null}
      </li>) : <li className={emptyItemClassName}>No training recorded.</li>}
    </ul>
    {notice ? <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice}</p> : null}
    <DeleteRecordDialog entityId={deleting} entityType="training_record" noun="training record" onClose={() => setDeleting(null)} onDeleted={() => setNotice("The training record was deleted successfully.")} />
    {!editable ? null : editing ? <div className="mt-4"><div className="flex items-center justify-between"><h3 className="font-medium">Edit training</h3><Button onClick={() => setEditing(null)} size="sm" type="button" variant="ghost">Cancel edit</Button></div><RecordEntryForm employeeId={employeeId} key={editing.id} kind="training" onSaved={async (input, id) => { await save.mutateAsync({ id, input: input as never }); setEditing(null); }} pending={save.isPending} training={editing} /></div> : <RecordEntryForm employeeId={employeeId} kind="training" onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} />}
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
      detail: [entry.department_id ? departmentNames.get(entry.department_id) : null, formatDateRange(entry.started_on, entry.ended_on)].filter(Boolean).join(" · "),
      date: entry.started_on,
    })),
    ...((qualifications.data ?? []) as Qualification[]).map((entry): TimelineItem => ({
      id: `qualification-${entry.id}`, icon: GraduationCap, tone: "violet", category: "Eligibility",
      title: entry.name, detail: entry.notes ?? undefined, date: entry.awarded_on,
    })),
    ...((certifications.data ?? []) as Certification[]).map((entry): TimelineItem => ({
      id: `certification-${entry.id}`, icon: Award, tone: "amber", category: "Certification / Training",
      title: entry.name, detail: entry.notes ?? undefined, date: entry.issued_on,
    })),
    ...((trainings.data ?? []) as TrainingRecord[]).map((entry): TimelineItem => ({
      id: `training-${entry.id}`, icon: BookOpenCheck, tone: "emerald", category: "Certification / Training",
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

const genderLabels: Record<NonNullable<Employee["gender"]>, string> = { female: "Female", male: "Male", prefer_not_to_say: "Prefer not to say" };
const savedMessages = { created: "Employee account has been saved.", edited: "Employee account has been edited successfully." } as const;

type DetailRow = { label: string; value: ReactNode; wide?: boolean };

/** One numbered group of the official record, laid out like the edit form. */
function DetailSection({ title, rows }: { title: string; rows: DetailRow[] }) {
  return (
    <section aria-label={title} className="min-w-0">
      <h3 className="mb-4 border-b pb-2 font-heading text-lg font-semibold">{title}</h3>
      <div className="@container">
        <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @xl:grid-cols-3">
          {rows.map(({ label, value, wide }) => (
            <div className={wide ? "min-w-0 @md:col-span-2 @xl:col-span-3" : "min-w-0"} key={label}>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
              <dd className="mt-1 font-medium break-words">{value || <span className="font-normal text-muted-foreground">Not provided</span>}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** The official record as a read-only view, shown in view mode instead of the form. */
function OfficialDetails({ record, departmentName, rankName }: { record: Employee; departmentName?: string; rankName?: string }) {
  return (
    <div className="space-y-8">
      <DetailSection title="I. Personal Information" rows={[
        { label: "Rank", value: rankName },
        { label: "Badge number", value: <span className="tabular-nums">{record.employee_number}</span> },
        { label: "Personal email", value: record.personal_email },
        { label: "First name", value: record.first_name },
        { label: "Middle name", value: record.middle_name },
        { label: "Last name", value: record.last_name },
        { label: "Qualifier", value: record.qualifier },
        { label: "Place of birth", value: record.place_of_birth },
        { label: "Date of birth", value: formatDate(record.date_of_birth) },
        { label: "Gender", value: record.gender ? genderLabels[record.gender] : null },
        { label: "Civil status", value: titleCase(record.civil_status) },
        { label: "Religion", value: record.religion },
        { label: "Phone number", value: record.phone },
        { label: "Home address", value: record.address, wide: true },
      ]} />
      <DetailSection title="II. Emergency Contact" rows={[
        { label: "Name", value: record.emergency_contact_name },
        { label: "Phone number", value: record.emergency_contact_phone },
      ]} />
      <DetailSection title="III. Employment" rows={[
        { label: "Unit / Section", value: departmentName },
        { label: "Unit / Station", value: record.unit_station },
        { label: "Employment status", value: record.employment_status === "on_leave" ? "On leave" : "Active" },
        { label: "Employment start date", value: formatDate(record.employment_started_on) },
      ]} />
    </div>
  );
}

export function EmployeeRecordDetail({ employeeId }: { employeeId: string }) {
  const employee = useEmployee(employeeId);
  const ranks = useRankOptions();
  const departments = useDepartmentOptions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseRecordTab(searchParams.get("tab"));
  // View mode is read-only; `?mode=edit` (the directory Edit link or "Edit details") unlocks every section.
  const editing = searchParams.get("mode") === "edit";
  const saved = searchParams.get("saved");
  const savedMessage = saved === "created" || saved === "edited" ? savedMessages[saved] : null;
  const panelsRef = useRef<HTMLDivElement>(null);
  const rankTitles = useMemo(() => new Map((ranks.data ?? []).map((rank) => [rank.id, rankLabel(rank)])), [ranks.data]);
  const departmentNames = useMemo(() => new Map((departments.data ?? []).map((department) => [department.id, department.name])), [departments.data]);
  const activity = useRecordActivity(employeeId, rankTitles, departmentNames);

  /** Rewrites the URL query; any navigation also clears the one-time "saved" confirmation. */
  function updateParams(change: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("saved");
    change(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function showTab(key: RecordTabKey) {
    updateParams((params) => params.set("tab", key));
  }

  function editDetails() {
    updateParams((params) => {
      params.set("tab", "official");
      params.set("mode", "edit");
    });
    panelsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function stopEditing() {
    updateParams((params) => params.delete("mode"));
  }

  if (employee.isLoading) return <LoadingState label="Loading employee record…" />;
  if (employee.error || !employee.data) return <ErrorState message={employee.error?.message ?? "Employee record was not found."} />;
  const record = employee.data;
  const fullName = [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(" ");
  const rank = record.rank_id ? ranks.data?.find((row) => row.id === record.rank_id) : undefined;
  const departmentName = record.department_id ? departmentNames.get(record.department_id) : undefined;
  const panels: Record<RecordTabKey, ReactNode> = {
    official: (
      <InfoCard
        action={editing ? <Button onClick={stopEditing} size="sm" type="button" variant="outline">Cancel</Button> : null}
        icon={UserRound}
        id="records-official"
        title="Official record"
      >
        {editing ? <EmployeeEditor employee={record} /> : <OfficialDetails departmentName={departmentName} rankName={rank ? rankLabel(rank) : undefined} record={record} />}
      </InfoCard>
    ),
    activity: (
      <InfoCard icon={Activity} id="recent-activity" title="Recent activity">
        {activity.loading ? <LoadingState label="Loading recent activity…" /> : <ActivityTimeline emptyMessage="No service history, eligibility, or certification / training entries yet." items={activity.items} />}
      </InfoCard>
    ),
    "service-history": <Records editable={editing} employeeId={employeeId} kind="serviceHistory" />,
    qualifications: <Records editable={editing} employeeId={employeeId} kind="qualification" />,
    certifications: <Records editable={editing} employeeId={employeeId} kind="certification" />,
    training: <TrainingRecords editable={editing} employeeId={employeeId} />,
  };

  return <div className="space-y-6">
    <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline" href="/hr/employees"><ArrowLeft aria-hidden className="size-4" />Back to employees</Link>
    {savedMessage ? (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100" role="status">
        <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p className="flex-1 font-medium">{savedMessage}</p>
        <button aria-label="Dismiss message" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900" onClick={() => updateParams(() => undefined)} type="button"><X aria-hidden className="size-4" /></button>
      </div>
    ) : null}
    <ProfileHeaderCard
      actions={<>
        {editing
          ? <Button onClick={stopEditing} size="sm" type="button" variant="outline">Done editing</Button>
          : <Button onClick={editDetails} size="sm" type="button"><Pencil aria-hidden />Edit details</Button>}
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/hr/promotions/${record.id}`}><TrendingUp aria-hidden />Promotion review</Link>
      </>}
      meta={[
        { label: "Badge number", value: <span className="tabular-nums">{record.employee_number}</span>, icon: BadgeCheck },
        { label: "Status", value: record.employment_status === "on_leave" ? "On leave" : "Active", icon: ShieldCheck },
        { label: "Born", value: formatDay(record.date_of_birth) ?? "Not provided", icon: Cake },
        { label: "Gender", value: titleCase(record.gender) ?? "Not provided", icon: UserRound },
        { label: "Years of service", value: serviceLength(record.employment_started_on, record.employment_ended_on) ?? "Not recorded", icon: Clock },
        { label: "Unit / Section", value: departmentName ?? "Not assigned", icon: Building2 },
        { label: "Unit / Station", value: record.unit_station || "Not assigned", icon: MapPin },
      ]}
      name={fullName}
      photo={<EmployeeProfilePhotoControl employee={record} />}
      subtitle={rank ? rankLabel(rank) : "Rank not provided"}
      tags={activity.certificationNames}
    />

    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
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
    </div>
  </div>;
}
