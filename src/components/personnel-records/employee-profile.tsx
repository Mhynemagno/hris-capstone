import type { ReactNode } from "react";
import { Award, BadgeCheck, Building2, Cake, Church, Clock, GraduationCap, HeartPulse, History, House, Mail, MapPin, Phone, ShieldCheck, UserRound, Users } from "lucide-react";

import { useDepartmentOptions, useRankOptions } from "@/hooks/use-administration";
import { rankLabel } from "@/lib/ranks";
import type { Certification, Employee, Qualification, ServiceHistory, TrainingRecord } from "@/lib/types/database";

import { EmployeeProfilePhotoControl } from "./employee-profile-photo-control";
import { formatDay, InfoCard, InfoList, ProfileHeaderCard, serviceLength } from "./profile-layout";

type EmployeeProfileProps = {
  employee: Employee;
  trainings: TrainingRecord[];
  /** Eligibility (qualifications); the section is hidden when not provided. */
  qualifications?: Qualification[];
  /** Service history and certifications appear only when entries exist. */
  serviceHistory?: ServiceHistory[];
  certifications?: Certification[];
  canManagePhoto?: boolean;
  /** Optional header actions, such as links to request a profile change. */
  actions?: ReactNode;
  /** `summary` shows only the name, rank, and key service facts (the employee dashboard); `full` is the complete profile. */
  variant?: "full" | "summary";
};

function valueOrNotProvided(value: string | null | undefined) {
  return value || "Not provided";
}

function words(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()) : null;
}

type RecordItem = { id: string; title: string; detail: string };

/** A read-only list of personnel entries. */
function RecordList({ items, emptyMessage }: { items: RecordItem[]; emptyMessage: string }) {
  if (!items.length) return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  return <ul className="space-y-2">{items.map((item) => <li className="rounded-xl border bg-background/60 px-4 py-3" key={item.id}><p className="font-semibold break-words">{item.title}</p>{item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}</li>)}</ul>;
}

const byNewest = <T,>(rows: T[], date: (row: T) => string) => rows.toSorted((a, b) => date(b).localeCompare(date(a)));

export function EmployeeProfile({ employee, trainings, qualifications, serviceHistory = [], certifications = [], canManagePhoto = false, actions, variant = "full" }: EmployeeProfileProps) {
  const fullName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");
  const ranks = useRankOptions();
  const departments = useDepartmentOptions();
  const rank = employee.rank_id ? ranks.data?.find((row) => row.id === employee.rank_id) : undefined;
  const department = employee.department_id ? departments.data?.find((row) => row.id === employee.department_id) : undefined;

  const badge = { label: "Badge number", value: <span className="tabular-nums">{employee.employee_number}</span>, icon: BadgeCheck };
  const status = { label: "Status", value: employee.employment_status === "on_leave" ? "On leave" : "Active", icon: ShieldCheck };
  const service = { label: "Years of service", value: serviceLength(employee.employment_started_on, employee.employment_ended_on) ?? "Not recorded", icon: Clock };
  const assignment = [
    { label: "Unit / Section", value: department?.name ?? "Not assigned", icon: Building2 },
    { label: "Unit / Station", value: employee.unit_station || "Not assigned", icon: MapPin },
  ];
  const subtitle = rank ? rankLabel(rank) : "Rank not provided";

  if (variant === "summary") return <ProfileHeaderCard actions={actions} meta={[badge, status, service, ...assignment]} name={fullName} subtitle={subtitle} />;

  return <div className="space-y-6">
    <ProfileHeaderCard
      actions={actions}
      meta={[
        badge,
        status,
        { label: "Born", value: valueOrNotProvided(formatDay(employee.date_of_birth)), icon: Cake },
        { label: "Gender", value: valueOrNotProvided(words(employee.gender)), icon: UserRound },
        service,
        ...assignment,
      ]}
      name={fullName}
      photo={<EmployeeProfilePhotoControl canManagePhoto={canManagePhoto} employee={employee} />}
      subtitle={subtitle}
      tags={[
        ...(employee.employment_started_on ? [`In service since ${formatDay(employee.employment_started_on)}`] : []),
        ...(trainings.length ? [`${trainings.length} ${trainings.length === 1 ? "training" : "trainings"} completed`] : []),
      ]}
    />

    <div className="grid content-start gap-6 md:grid-cols-2">
        <InfoCard icon={Mail} id="profile-contact" title="Contact information">
          <InfoList rows={[
            { label: "Personal email", value: employee.personal_email, icon: Mail },
            { label: "Phone number", value: valueOrNotProvided(employee.phone), icon: Phone },
          ]} />
        </InfoCard>
        <InfoCard icon={HeartPulse} id="profile-emergency" title="Emergency contact">
          <InfoList rows={[
            { label: "Name", value: valueOrNotProvided(employee.emergency_contact_name), icon: Users },
            { label: "Phone number", value: valueOrNotProvided(employee.emergency_contact_phone), icon: Phone },
          ]} />
        </InfoCard>
        <InfoCard icon={House} id="profile-address" title="Address information">
          <InfoList rows={[
            { label: "Home address", value: valueOrNotProvided(employee.address), icon: House },
            { label: "Place of birth", value: valueOrNotProvided(employee.place_of_birth), icon: MapPin },
          ]} />
        </InfoCard>
        <InfoCard icon={UserRound} id="profile-details" title="Personal details">
          <InfoList rows={[
            { label: "Civil status", value: valueOrNotProvided(words(employee.civil_status)), icon: Users },
            { label: "Religion", value: valueOrNotProvided(employee.religion), icon: Church },
          ]} />
        </InfoCard>
        {qualifications ? <InfoCard className="md:col-span-2" icon={GraduationCap} id="profile-eligibility" title="Eligibility">
          <RecordList emptyMessage="No eligibility recorded." items={byNewest(qualifications, (row) => row.awarded_on).map((row) => ({ id: row.id, title: row.name, detail: [formatDay(row.awarded_on), row.notes].filter(Boolean).join(" · ") }))} />
        </InfoCard> : null}
        {serviceHistory.length ? <InfoCard className="md:col-span-2" icon={History} id="profile-service-history" title="Service history">
          <RecordList emptyMessage="" items={byNewest(serviceHistory, (row) => row.started_on).map((row) => {
            const entryRank = row.rank_id ? ranks.data?.find((option) => option.id === row.rank_id) : undefined;
            const entryDepartment = row.department_id ? departments.data?.find((option) => option.id === row.department_id) : undefined;
            return { id: row.id, title: row.employment_title || (entryRank ? rankLabel(entryRank) : "Service entry"), detail: [entryDepartment?.name, `${formatDay(row.started_on) ?? row.started_on} – ${row.ended_on ? formatDay(row.ended_on) ?? row.ended_on : "present"}`].filter(Boolean).join(" · ") };
          })} />
        </InfoCard> : null}
        {certifications.length ? <InfoCard className="md:col-span-2" icon={Award} id="profile-certifications" title="Certification / Training">
          <RecordList emptyMessage="" items={byNewest(certifications, (row) => row.issued_on).map((row) => ({ id: row.id, title: row.name, detail: [row.issued_on ? `Completed ${formatDay(row.issued_on)}` : null, row.notes].filter(Boolean).join(" · ") }))} />
        </InfoCard> : null}
    </div>
  </div>;
}
