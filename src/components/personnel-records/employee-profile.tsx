import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Employee, TrainingRecord } from "@/lib/types/database";

type EmployeeProfileProps = {
  employee: Employee;
  trainings: TrainingRecord[];
};

function initials(employee: Employee) {
  return `${employee.first_name[0] ?? ""}${employee.last_name[0] ?? ""}`.toUpperCase() || "EP";
}

function valueOrNotProvided(value: string | null) {
  return value || "Not provided";
}

export function EmployeeProfile({ employee, trainings }: EmployeeProfileProps) {
  const fullName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");

  return <div className="space-y-6">
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="size-20 border text-xl"><AvatarFallback>{initials(employee)}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{employee.rank ?? "Rank not provided"}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span><span className="text-muted-foreground">Badge number</span> <strong>{employee.employee_number}</strong></span><span><span className="text-muted-foreground">Unit / Station</span> <strong>{valueOrNotProvided(employee.unit_station)}</strong></span></div>
        </div>
      </div>
    </section>

    <section aria-labelledby="profile-details" className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 id="profile-details" className="text-lg font-semibold">Profile details</h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Personal email</dt><dd className="mt-1 font-medium">{employee.personal_email}</dd></div>
        <div><dt className="text-muted-foreground">Phone</dt><dd className="mt-1 font-medium">{valueOrNotProvided(employee.phone)}</dd></div>
        <div><dt className="text-muted-foreground">Emergency contact</dt><dd className="mt-1 font-medium">{valueOrNotProvided(employee.emergency_contact_name)}</dd></div>
        <div><dt className="text-muted-foreground">Emergency phone</dt><dd className="mt-1 font-medium">{valueOrNotProvided(employee.emergency_contact_phone)}</dd></div>
      </dl>
    </section>

    <section aria-labelledby="training" className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 id="training" className="text-lg font-semibold">Training</h2>
      {trainings.length ? <ul className="mt-4 space-y-3">{trainings.map((training) => <li className="rounded-xl bg-muted p-4" key={training.id}><p className="font-medium">{training.course_name}</p><p className="mt-1 text-sm text-muted-foreground">{training.provider} · {training.completed_on}{training.hours === null ? "" : ` · ${training.hours} hours`}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No training records have been added.</p>}
    </section>
  </div>;
}
