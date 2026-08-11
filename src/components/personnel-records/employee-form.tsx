"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Employee } from "@/lib/types/database";
import { employeeSchema, type EmployeeInput } from "@/schemas/personnel-records";

type EmployeeFormProps = {
  employee?: Employee;
  onSaved: (input: EmployeeInput) => void | Promise<void>;
  pending?: boolean;
};

export function EmployeeForm({ employee, onSaved, pending = false }: EmployeeFormProps) {
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = employeeSchema.safeParse({
      ...form,
      profileId: form.profileId || undefined,
      departmentId: form.departmentId || undefined,
      positionId: form.positionId || undefined,
      employmentEndedOn: form.employmentEndedOn || undefined,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the employee details.");
    try { await onSaved(parsed.data); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save the employee."); }
  }

  return <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
    <FormField htmlFor="employee-number" label="Employee number"><Input className="h-11" defaultValue={employee?.employee_number} id="employee-number" name="employeeNumber" placeholder="EMP-0001" required /></FormField>
    <FormField htmlFor="personal-email" label="Personal email"><Input className="h-11" defaultValue={employee?.personal_email} id="personal-email" name="personalEmail" type="email" required /></FormField>
    <FormField htmlFor="first-name" label="First name"><Input className="h-11" defaultValue={employee?.first_name} id="first-name" name="firstName" required /></FormField>
    <FormField htmlFor="last-name" label="Last name"><Input className="h-11" defaultValue={employee?.last_name} id="last-name" name="lastName" required /></FormField>
    <FormField htmlFor="phone" label="Phone"><Input className="h-11" defaultValue={employee?.phone ?? ""} id="phone" name="phone" /></FormField>
    <FormField htmlFor="employment-status" label="Employment status"><select className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" defaultValue={employee?.employment_status ?? "active"} id="employment-status" name="employmentStatus"><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option><option value="separated">Separated</option></select></FormField>
    <FormField htmlFor="employment-started-on" label="Employment start date"><Input className="h-11" defaultValue={employee?.employment_started_on} id="employment-started-on" name="employmentStartedOn" type="date" required /></FormField>
    <FormField htmlFor="employment-ended-on" label="Employment end date"><Input className="h-11" defaultValue={employee?.employment_ended_on ?? ""} id="employment-ended-on" name="employmentEndedOn" type="date" /></FormField>
    {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
    <div className="sm:col-span-2"><Button className="h-11 w-full sm:w-auto" disabled={pending} type="submit">{pending ? "Saving…" : "Save employee"}</Button></div>
  </form>;
}
