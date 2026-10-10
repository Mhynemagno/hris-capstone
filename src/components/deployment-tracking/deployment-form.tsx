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
import type { Deployment } from "@/lib/types/database";
import { DEPLOYMENT_STATUSES, DEPLOYMENT_TYPES, deploymentInputSchema, EVENT_OPERATIONS, type DeploymentInput } from "@/schemas/deployment-tracking";

import { deploymentStatusLabels } from "./deployment-status-badge";

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
      endsOn: typeof values.endsOn === "string" && values.endsOn ? values.endsOn : null,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= key === "employeeId" ? "Choose an employee." : issue.message;
      }
      setFieldErrors(errors);
      if (errors.form) setError(errors.form);
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
      <FormField error={e.location} htmlFor="location" label="Location" required>
        <Input defaultValue={deployment?.location ?? ""} id="location" maxLength={200} name="location" required />
      </FormField>
      {/* Unit / Assignment is no longer asked for; an existing value is carried through unchanged. */}
      {deployment?.unit ? <input name="unit" type="hidden" value={deployment.unit} /> : null}
      <FormField error={e.deploymentType} htmlFor="deployment-type" label="Deployment type" required>
        <NativeSelect defaultValue={deployment?.deployment_type ?? ""} id="deployment-type" name="deploymentType" required>
          <option value="">Select a deployment type</option>
          {DEPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </NativeSelect>
      </FormField>
      <FormField error={e.eventOperation} htmlFor="event-operation" label="Event / Operation" required>
        <NativeSelect defaultValue={deployment?.event_operation ?? ""} id="event-operation" name="eventOperation" required>
          <option value="">Select an event / operation</option>
          {EVENT_OPERATIONS.map((event) => <option key={event} value={event}>{event}</option>)}
        </NativeSelect>
      </FormField>
      <FormField error={e.status} htmlFor="status" label="Status" required>
        <NativeSelect defaultValue={deployment?.status ?? "scheduled"} id="status" name="status">
          {DEPLOYMENT_STATUSES.map((status) => <option key={status} value={status}>{deploymentStatusLabels[status]}</option>)}
        </NativeSelect>
      </FormField>
      <FormField error={e.startsOn} htmlFor="starts-on" label="Start date" required>
        <Input defaultValue={deployment?.starts_on} id="starts-on" name="startsOn" required type="date" />
      </FormField>
      <FormField description="Optional. Leave blank for a one-day deployment." error={e.endsOn} htmlFor="ends-on" label="End date">
        <Input defaultValue={deployment?.ends_on ?? ""} id="ends-on" name="endsOn" type="date" />
      </FormField>
      <div className="sm:col-span-2">
        <FormField error={e.notes} htmlFor="notes" label="Remarks" required>
          <Textarea defaultValue={deployment?.notes ?? ""} id="notes" maxLength={2000} name="notes" required />
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
