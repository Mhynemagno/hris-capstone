import type { ReactNode } from "react";
import { BadgeCheck, BookOpenCheck, Building2, Cake, Church, Clock, HeartPulse, House, Mail, MapPin, Phone, ShieldCheck, UserRound, Users } from "lucide-react";

import { useDepartmentOptions, useRankOptions } from "@/hooks/use-administration";
import { rankLabel } from "@/lib/ranks";
import type { Employee, TrainingRecord } from "@/lib/types/database";

import { EmployeeProfilePhotoControl } from "./employee-profile-photo-control";
import { ActivityTimeline, formatDay, InfoCard, InfoList, ProfileHeaderCard, serviceLength } from "./profile-layout";

type EmployeeProfileProps = {
  employee: Employee;
  trainings: TrainingRecord[];
  canManagePhoto?: boolean;
  /** Optional header actions, such as links to request a profile change. */
  actions?: ReactNode;
};

function valueOrNotProvided(value: string | null | undefined) {
  return value || "Not provided";
}

function words(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()) : null;
}

export function EmployeeProfile({ employee, trainings, canManagePhoto = false, actions }: EmployeeProfileProps) {
  const fullName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");
  const ranks = useRankOptions();
  const departments = useDepartmentOptions();
  const rank = employee.rank_id ? ranks.data?.find((row) => row.id === employee.rank_id) : undefined;
  const department = employee.department_id ? departments.data?.find((row) => row.id === employee.department_id) : undefined;
  const sortedTrainings = trainings.toSorted((a, b) => b.completed_on.localeCompare(a.completed_on));
  const totalHours = trainings.reduce((sum, training) => sum + (training.hours ?? 0), 0);

  return <div className="space-y-6">
    <ProfileHeaderCard
      actions={actions}
      meta={[
        { label: "Badge number", value: <span className="tabular-nums">{employee.employee_number}</span>, icon: BadgeCheck },
        { label: "Status", value: employee.employment_status === "on_leave" ? "On leave" : "Active", icon: ShieldCheck },
        { label: "Born", value: valueOrNotProvided(formatDay(employee.date_of_birth)), icon: Cake },
        { label: "Gender", value: valueOrNotProvided(words(employee.gender)), icon: UserRound },
        { label: "Years of service", value: serviceLength(employee.employment_started_on, employee.employment_ended_on) ?? "Not recorded", icon: Clock },
        { label: "Department", value: department?.name ?? "Not assigned", icon: Building2 },
        { label: "Unit / Station", value: employee.unit_station || "Not assigned", icon: MapPin },
      ]}
      name={fullName}
      photo={<EmployeeProfilePhotoControl canManagePhoto={canManagePhoto} employee={employee} />}
      subtitle={rank ? rankLabel(rank) : "Rank not provided"}
      tags={[
        ...(employee.employment_started_on ? [`In service since ${formatDay(employee.employment_started_on)}`] : []),
        ...(trainings.length ? [`${trainings.length} ${trainings.length === 1 ? "training" : "trainings"} completed`] : []),
      ]}
    />

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid content-start gap-6 md:grid-cols-2">
        <InfoCard icon={Mail} id="profile-contact" title="Contact information">
          <InfoList rows={[
            { label: "Personal email", value: employee.personal_email, icon: Mail },
            { label: "Phone", value: valueOrNotProvided(employee.phone), icon: Phone },
          ]} />
        </InfoCard>
        <InfoCard icon={HeartPulse} id="profile-emergency" title="Emergency contact">
          <InfoList rows={[
            { label: "Emergency contact", value: valueOrNotProvided(employee.emergency_contact_name), icon: Users },
            { label: "Emergency phone", value: valueOrNotProvided(employee.emergency_contact_phone), icon: Phone },
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
      </div>

      <InfoCard
        action={totalHours ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{totalHours} hrs total</span> : undefined}
        className="self-start"
        icon={BookOpenCheck}
        id="training"
        title="Training"
      >
        <ActivityTimeline
          emptyMessage="No training records have been added."
          items={sortedTrainings.map((training) => ({
            id: training.id,
            icon: BookOpenCheck,
            tone: "primary",
            category: formatDay(training.completed_on) ?? "Completed",
            title: training.course_name,
            detail: [training.provider, training.hours === null ? null : `${training.hours} hours`].filter(Boolean).join(" · "),
            date: training.completed_on,
          }))}
        />
      </InfoCard>
    </div>
  </div>;
}
