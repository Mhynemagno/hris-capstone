"use client";

import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useEmployeeOptions } from "@/hooks/use-deployment-tracking";
import { useUnitStations } from "@/hooks/use-personnel-records";
import type { Deployment, DeploymentStatus } from "@/lib/types/database";
import { deploymentInputSchema, type DeploymentInput } from "@/schemas/deployment-tracking";

const statusLabels: Record<DeploymentStatus, string> = {
  active: "Active",
  rejected: "Rejected",
};

type DeploymentFormProps = {
  deployment?: Deployment;
  onSaved: (input: DeploymentInput) => Promise<void> | void;
  pending?: boolean;
};

export function DeploymentForm({ deployment, onSaved, pending = false }: DeploymentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const employees = useEmployeeOptions();
  const unitStations = useUnitStations();
  const employeeOptions = useMemo<ComboboxOption[]>(
    () => (employees.data ?? []).map((employee) => ({ value: employee.id, label: employee.fullName, description: employee.employeeNumber })),
    [employees.data],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setFieldErrors({});
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = deploymentInputSchema.safeParse({
      ...values,
      employeeId: deployment?.employee_id ?? employeeId ?? values.employeeId,
      // Existing end dates are preserved; they are not edited from this form.
      endsOn: deployment?.ends_on || null,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= key === "employeeId" ? "Choose an employee." : issue.message;
      }
      setFieldErrors(errors);
      if (errors.form || errors.endsOn) setError(errors.form ?? errors.endsOn ?? null);
      return;
    }
    try {
      await onSaved(parsed.data);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save deployment.");
    }
  }

  const e = fieldErrors;
  const employeeDescription = employees.isLoading
    ? "Loading employees…"
    : employees.error
      ? "Employees could not be loaded. Refresh the page to try again."
      : "Search by name or badge number.";

  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
      {!deployment ? (
        <div className="sm:col-span-2">
          <FormField description={employeeDescription} error={e.employeeId} htmlFor="employee-id" label="Employee" required>
            <Combobox
              disabled={employees.isLoading}
              emptyMessage="No employees match that name or badge number."
              id="employee-id"
              name="employeeId"
              onValueChange={(value) => {
                setEmployeeId(value);
                setFieldErrors((current) => ({ ...current, employeeId: "" }));
              }}
              options={employeeOptions}
              placeholder={employees.isLoading ? "Loading employees…" : "Type a name or badge number"}
              required
              value={employeeId}
            />
          </FormField>
        </div>
      ) : null}
      <FormField error={e.assignmentRole} htmlFor="assignment-role" label="Assignment role" required>
        <Input defaultValue={deployment?.assignment_role} id="assignment-role" name="assignmentRole" required />
      </FormField>
      <FormField description="Provide a location, unit, or project." error={e.location} htmlFor="location" label="Location">
        <Input defaultValue={deployment?.location ?? ""} id="location" name="location" />
      </FormField>
      <FormField
        description={unitStations.error ? "Unit stations could not be loaded. Refresh the page to try again." : undefined}
        error={e.unit}
        htmlFor="unit"
        label="Unit assignment"
      >
        <NativeSelect defaultValue={deployment?.unit ?? ""} id="unit" name="unit">
          <option value="">Select a unit/station</option>
          {deployment?.unit && !unitStations.data?.some((unit) => unit.name === deployment.unit) ? <option value={deployment.unit}>{deployment.unit}</option> : null}
          {unitStations.data?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
        </NativeSelect>
      </FormField>
      <FormField error={e.project} htmlFor="project" label="Project">
        <Input defaultValue={deployment?.project ?? ""} id="project" name="project" />
      </FormField>
      <FormField error={e.status} htmlFor="status" label="Status" required>
        <NativeSelect defaultValue={deployment?.status ?? "active"} id="status" name="status">
          {(Object.keys(statusLabels) as DeploymentStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </NativeSelect>
      </FormField>
      <FormField error={e.startsOn} htmlFor="starts-on" label="Start date" required>
        <Input defaultValue={deployment?.starts_on} id="starts-on" name="startsOn" required type="date" />
      </FormField>
      <div className="sm:col-span-2">
        <FormField error={e.notes} htmlFor="notes" label="Notes">
          <Textarea defaultValue={deployment?.notes ?? ""} id="notes" maxLength={2000} name="notes" />
        </FormField>
      </div>
      {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button disabled={pending} type="submit">{pending ? "Saving…" : "Save deployment"}</Button>
        {saved && !pending ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">Deployment saved.</p> : null}
      </div>
    </form>
  );
}
