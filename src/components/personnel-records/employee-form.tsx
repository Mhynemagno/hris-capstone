"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useUnitStations } from "@/hooks/use-personnel-records";
import type { Employee, UnlinkedEmployeeAccount } from "@/lib/types/database";
import { employeeSchema, POLICE_RANKS, type EmployeeInput } from "@/schemas/personnel-records";

type EmployeeFormProps = {
  employee?: Employee;
  account?: UnlinkedEmployeeAccount;
  onSaved: (input: EmployeeInput) => void | Promise<void>;
  pending?: boolean;
};

export function EmployeeForm({ employee, account, onSaved, pending = false }: EmployeeFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const unitStations = useUnitStations();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = employeeSchema.safeParse({
      ...form,
      profileId: form.profileId || undefined,
      departmentId: form.departmentId || undefined,
      positionId: form.positionId || undefined,
      employmentEndedOn: form.employmentEndedOn || undefined,
    });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])));
      return;
    }
    try { await onSaved(parsed.data); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save the employee."); }
  }

  return <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
    {account ? <input name="profileId" type="hidden" value={account.profile_id} /> : null}
    <FormField error={fieldErrors.employeeNumber} htmlFor="employee-number" label="Badge number"><Input className="h-11" defaultValue={employee?.employee_number} id="employee-number" name="employeeNumber" placeholder="PAT-0001" required /></FormField>
    <FormField htmlFor="rank" label="Rank"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" defaultValue={employee?.rank ?? ""} id="rank" name="rank"><option value="">Not provided</option>{POLICE_RANKS.map((rank) => <option key={rank} value={rank}>{rank}</option>)}</select></FormField>
    <FormField error={fieldErrors.personalEmail} htmlFor="personal-email" label="Personal email"><Input className="h-11" defaultValue={employee?.personal_email ?? account?.email ?? ""} id="personal-email" name="personalEmail" type="email" required /></FormField>
    <FormField error={fieldErrors.firstName} htmlFor="first-name" label="First name"><Input className="h-11" defaultValue={employee?.first_name ?? account?.first_name ?? ""} id="first-name" name="firstName" required /></FormField>
    <FormField htmlFor="middle-name" label="Middle name"><Input className="h-11" defaultValue={employee?.middle_name ?? ""} id="middle-name" name="middleName" /></FormField>
    <FormField error={fieldErrors.lastName} htmlFor="last-name" label="Last name"><Input className="h-11" defaultValue={employee?.last_name ?? account?.last_name ?? ""} id="last-name" name="lastName" required /></FormField>
    <FormField htmlFor="qualifier" label="Qualifier"><Input className="h-11" defaultValue={employee?.qualifier ?? ""} id="qualifier" name="qualifier" placeholder="Jr., Sr., III" /></FormField>
    <FormField htmlFor="place-of-birth" label="Place of birth"><Input className="h-11" defaultValue={employee?.place_of_birth ?? ""} id="place-of-birth" name="placeOfBirth" /></FormField>
    <FormField htmlFor="date-of-birth" label="Date of birth"><Input className="h-11" defaultValue={employee?.date_of_birth ?? ""} id="date-of-birth" name="dateOfBirth" type="date" /></FormField>
    <FormField htmlFor="sex" label="Sex"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" defaultValue={employee?.sex ?? ""} id="sex" name="sex"><option value="">Not provided</option><option value="female">Female</option><option value="male">Male</option><option value="prefer_not_to_say">Prefer not to say</option></select></FormField>
    <FormField htmlFor="civil-status" label="Civil status"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" defaultValue={employee?.civil_status ?? ""} id="civil-status" name="civilStatus"><option value="">Not provided</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option><option value="separated">Separated</option><option value="divorced">Divorced</option></select></FormField>
    <FormField htmlFor="religion" label="Religion"><Input className="h-11" defaultValue={employee?.religion ?? ""} id="religion" name="religion" /></FormField>
    <FormField htmlFor="phone" label="Phone"><Input className="h-11" defaultValue={employee?.phone ?? ""} id="phone" name="phone" /></FormField>
    <FormField htmlFor="address" label="Home address"><Input className="h-11" defaultValue={employee?.address ?? ""} id="address" name="address" /></FormField>
    <FormField htmlFor="emergency-contact-name" label="Emergency contact"><Input className="h-11" defaultValue={employee?.emergency_contact_name ?? ""} id="emergency-contact-name" name="emergencyContactName" /></FormField>
    <FormField htmlFor="emergency-contact-phone" label="Emergency contact phone"><Input className="h-11" defaultValue={employee?.emergency_contact_phone ?? ""} id="emergency-contact-phone" name="emergencyContactPhone" /></FormField>
    <FormField htmlFor="unit-station" label="Unit / Station"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" defaultValue={employee?.unit_station ?? ""} id="unit-station" name="unitStation"><option value="">Select a unit or station</option>{employee?.unit_station && !unitStations.data?.some((unit) => unit.name === employee.unit_station) ? <option value={employee.unit_station}>{employee.unit_station}</option> : null}{unitStations.data?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}</select>{unitStations.error ? <p className="mt-1 text-xs text-destructive">Unable to load unit stations.</p> : null}</FormField>
    <FormField htmlFor="employment-status" label="Employment status"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" defaultValue={employee?.employment_status ?? "active"} id="employment-status" name="employmentStatus"><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option><option value="separated">Separated</option></select></FormField>
    <FormField error={fieldErrors.employmentStartedOn} htmlFor="employment-started-on" label="Employment start date"><Input className="h-11" defaultValue={employee?.employment_started_on} id="employment-started-on" name="employmentStartedOn" type="date" required /></FormField>
    <FormField error={fieldErrors.employmentEndedOn} htmlFor="employment-ended-on" label="Employment end date"><Input className="h-11" defaultValue={employee?.employment_ended_on ?? ""} id="employment-ended-on" name="employmentEndedOn" type="date" /></FormField>
    {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
    <div className="sm:col-span-2"><Button className="h-11 w-full sm:w-auto" disabled={pending} type="submit">{pending ? "Saving…" : "Save employee"}</Button></div>
  </form>;
}
