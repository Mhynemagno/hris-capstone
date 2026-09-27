"use client";

import { useState, type FormEvent } from "react";

import { BadgeNumberInput } from "@/components/ui/badge-number-input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { useUnitStations } from "@/hooks/use-personnel-records";
import type { Employee, UnlinkedEmployeeAccount } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { BADGE_NUMBER_PATTERN } from "@/schemas/common";
import { employeeSchema, type EmployeeInput } from "@/schemas/personnel-records";

import { DepartmentRankFields } from "./department-rank-fields";

/** Greyed look for fields that cannot be changed once the record is saved. */
const lockedClassName = "cursor-not-allowed bg-muted text-muted-foreground focus-visible:ring-0 dark:bg-muted";
const lockedNote = "This cannot be changed once saved.";

type EmployeeFormProps = {
  employee?: Employee;
  account?: UnlinkedEmployeeAccount;
  onSaved: (input: EmployeeInput) => void | Promise<void>;
  pending?: boolean;
};

export function EmployeeForm({ employee, account, onSaved, pending = false }: EmployeeFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [departmentId, setDepartmentId] = useState(employee?.department_id ? String(employee.department_id) : "");
  const [rankId, setRankId] = useState(employee?.rank_id ? String(employee.rank_id) : "");
  const unitStations = useUnitStations();
  // Preserve the linked account: creating from an account binds it, editing keeps the existing link.
  const linkedProfileId = account?.profile_id ?? employee?.profile_id ?? null;
  // Identity and service-start fields are fixed once saved on an existing record. A field that was
  // never filled in (or a badge number still in the old format) stays editable so HR can complete it.
  const locked = {
    employeeNumber: Boolean(employee?.employee_number && BADGE_NUMBER_PATTERN.test(employee.employee_number)),
    placeOfBirth: Boolean(employee?.place_of_birth),
    dateOfBirth: Boolean(employee?.date_of_birth),
    gender: Boolean(employee?.gender),
    religion: Boolean(employee?.religion),
    employmentStartedOn: Boolean(employee?.employment_started_on),
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = employeeSchema.safeParse({
      ...form,
      profileId: form.profileId || undefined,
      departmentId: form.departmentId || undefined,
      rankId: form.rankId || undefined,
      employmentEndedOn: form.employmentEndedOn || undefined,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      setError(errors.form ?? "Complete the required fields marked with * before saving.");
      return;
    }
    try {
      await onSaved(parsed.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save the employee.");
    }
  }

  const e = fieldErrors;

  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
      {linkedProfileId ? <input name="profileId" type="hidden" value={linkedProfileId} /> : null}
      {/* The end date is no longer edited here; an existing value is carried through unchanged. */}
      {employee?.employment_ended_on ? <input name="employmentEndedOn" type="hidden" value={employee.employment_ended_on} /> : null}
      <FormField description={locked.employeeNumber ? lockedNote : "6 digits, e.g. 1-23456."} error={e.employeeNumber} htmlFor="employee-number" label="Badge number" required>
        <BadgeNumberInput className={cn("h-11 tabular-nums", locked.employeeNumber && lockedClassName)} defaultValue={employee?.employee_number} id="employee-number" name="employeeNumber" readOnly={locked.employeeNumber} required />
      </FormField>
      <FormField error={e.personalEmail} htmlFor="personal-email" label="Personal email" required>
        <Input className="h-11" defaultValue={employee?.personal_email ?? account?.email ?? ""} id="personal-email" name="personalEmail" type="email" autoComplete="email" required />
      </FormField>
      <FormField error={e.firstName} htmlFor="first-name" label="First name" required>
        <Input className="h-11" defaultValue={employee?.first_name ?? account?.first_name ?? ""} id="first-name" name="firstName" required />
      </FormField>
      <FormField error={e.middleName} htmlFor="middle-name" label="Middle name">
        <Input className="h-11" defaultValue={employee?.middle_name ?? ""} id="middle-name" name="middleName" />
      </FormField>
      <FormField error={e.lastName} htmlFor="last-name" label="Last name" required>
        <Input className="h-11" defaultValue={employee?.last_name ?? account?.last_name ?? ""} id="last-name" name="lastName" required />
      </FormField>
      <FormField error={e.qualifier} htmlFor="qualifier" label="Qualifier">
        <Input className="h-11" defaultValue={employee?.qualifier ?? ""} id="qualifier" name="qualifier" placeholder="Jr., Sr., III" />
      </FormField>
      <FormField description={locked.placeOfBirth ? lockedNote : undefined} error={e.placeOfBirth} htmlFor="place-of-birth" label="Place of birth" required>
        <Input className={cn("h-11", locked.placeOfBirth && lockedClassName)} defaultValue={employee?.place_of_birth ?? ""} id="place-of-birth" name="placeOfBirth" readOnly={locked.placeOfBirth} required />
      </FormField>
      <FormField description={locked.dateOfBirth ? lockedNote : undefined} error={e.dateOfBirth} htmlFor="date-of-birth" label="Date of birth" required>
        <Input className={cn("h-11", locked.dateOfBirth && lockedClassName)} defaultValue={employee?.date_of_birth ?? ""} id="date-of-birth" name="dateOfBirth" readOnly={locked.dateOfBirth} required type="date" />
      </FormField>
      <FormField description={locked.gender ? lockedNote : undefined} error={e.gender} htmlFor="gender" label="Gender" required>
        {/* A disabled select is left out of the submitted form, so a hidden input carries the saved value. */}
        <NativeSelect className={cn(locked.gender && lockedClassName)} defaultValue={employee?.gender ?? ""} disabled={locked.gender} id="gender" name={locked.gender ? undefined : "gender"} required>
          <option value="">Select a gender</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </NativeSelect>
      </FormField>
      {locked.gender && employee?.gender ? <input name="gender" type="hidden" value={employee.gender} /> : null}
      <FormField error={e.civilStatus} htmlFor="civil-status" label="Civil status">
        <NativeSelect defaultValue={employee?.civil_status ?? ""} id="civil-status" name="civilStatus">
          <option value="">Not provided</option>
          <option value="single">Single</option>
          <option value="married">Married</option>
          <option value="widowed">Widowed</option>
          <option value="separated">Separated</option>
          <option value="divorced">Divorced</option>
        </NativeSelect>
      </FormField>
      <FormField description={locked.religion ? lockedNote : undefined} error={e.religion} htmlFor="religion" label="Religion" required>
        <Input className={cn("h-11", locked.religion && lockedClassName)} defaultValue={employee?.religion ?? ""} id="religion" name="religion" readOnly={locked.religion} required />
      </FormField>
      <FormField description="Format: +639XXXXXXXXX" error={e.phone} htmlFor="phone" label="Phone" required>
        <PhoneInput defaultValue={employee?.phone} id="phone" name="phone" required />
      </FormField>
      <FormField error={e.address} htmlFor="address" label="Home address" required>
        <Input className="h-11" defaultValue={employee?.address ?? ""} id="address" name="address" autoComplete="street-address" required />
      </FormField>
      <FormField error={e.emergencyContactName} htmlFor="emergency-contact-name" label="Emergency contact" required>
        <Input className="h-11" defaultValue={employee?.emergency_contact_name ?? ""} id="emergency-contact-name" name="emergencyContactName" required />
      </FormField>
      <FormField description="Format: +639XXXXXXXXX" error={e.emergencyContactPhone} htmlFor="emergency-contact-phone" label="Emergency contact phone" required>
        <PhoneInput autoComplete="off" defaultValue={employee?.emergency_contact_phone} id="emergency-contact-phone" name="emergencyContactPhone" required />
      </FormField>
      <DepartmentRankFields
        departmentError={e.departmentId}
        departmentId={departmentId}
        departmentName="departmentId"
        idPrefix="employee"
        onDepartmentChange={setDepartmentId}
        onRankChange={setRankId}
        rankError={e.rankId}
        rankId={rankId}
        rankName="rankId"
        savedDepartmentId={employee?.department_id}
        savedRankId={employee?.rank_id}
      />
      <FormField
        description={unitStations.error ? "Unit stations could not be loaded. Refresh the page to try again." : undefined}
        error={e.unitStation}
        htmlFor="unit-station"
        label="Unit / Station"
      >
        <NativeSelect key={unitStations.data ? "catalogue" : "loading"} defaultValue={employee?.unit_station ?? ""} id="unit-station" name="unitStation">
          <option value="">Select a unit or station</option>
          {employee?.unit_station && !unitStations.data?.some((unit) => unit.name === employee.unit_station) ? <option value={employee.unit_station}>{employee.unit_station}</option> : null}
          {unitStations.data?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
        </NativeSelect>
      </FormField>
      <FormField error={e.employmentStatus} htmlFor="employment-status" label="Employment status" required>
        <NativeSelect defaultValue={employee?.employment_status ?? "active"} id="employment-status" name="employmentStatus" required>
          <option value="active">Active</option>
          <option value="on_leave">On leave</option>
        </NativeSelect>
      </FormField>
      <FormField
        description={locked.employmentStartedOn ? `The date they started in the service. ${lockedNote}` : "The date they started in the service."}
        error={e.employmentStartedOn}
        htmlFor="employment-started-on"
        label="Employment start date"
        required
      >
        <Input className={cn("h-11", locked.employmentStartedOn && lockedClassName)} defaultValue={employee?.employment_started_on ?? ""} id="employment-started-on" name="employmentStartedOn" readOnly={locked.employmentStartedOn} required type="date" />
      </FormField>
      {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
      <div className="sm:col-span-2">
        <Button className="h-11 w-full sm:w-auto" disabled={pending} type="submit">{pending ? "Saving…" : "Save employee"}</Button>
      </div>
    </form>
  );
}
