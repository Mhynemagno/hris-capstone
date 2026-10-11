"use client";

import { type FormEvent, useMemo, useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffInput, StaffLabel, StaffSelect, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { StaffSlideOver } from "@/components/staff-shell/ui/staff-slide-over";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { LoadingState } from "@/components/ui/loading-state";
import { useCreateDeployment, useDeployment, useEmployeeOptions, useUpdateDeployment } from "@/hooks/use-deployment-tracking";
import { DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";
import type { Deployment } from "@/lib/types/database";
import { DEPLOYMENT_STATUSES, DEPLOYMENT_TYPES, deploymentInputSchema, EVENT_OPERATIONS } from "@/schemas/deployment-tracking";

export type DeploymentPanelMode = { kind: "create" } | { kind: "edit"; id: string };

const FORM_ID = "deployment-panel-form";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-[10px] font-bold text-rose-500">{message}</p> : null;
}

function DeploymentFields({ deployment, errors, employeeId, onEmployee }: { deployment?: Deployment; errors: Record<string, string>; employeeId: string | null; onEmployee: (value: string | null) => void }) {
  const employees = useEmployeeOptions();
  const options = useMemo<ComboboxOption[]>(() => (employees.data ?? []).map((employee) => ({ value: employee.id, label: employee.fullName, description: employee.employeeNumber })), [employees.data]);
  const employeeName = deployment ? employees.data?.find((employee) => employee.id === deployment.employee_id)?.fullName : null;
  return (
    <>
      <div className="space-y-1">
        <StaffLabel htmlFor="deployment-employee" required={!deployment}>Employee</StaffLabel>
        {deployment ? (
          <p className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-700" id="deployment-employee">{employeeName ?? "Assigned employee"}</p>
        ) : (
          <Combobox
            className="rounded-xl border-slate-200 bg-slate-50"
            inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
            aria-label="Employee"
            disabled={employees.isLoading}
            emptyMessage="No employees match that name or badge number."
            id="deployment-employee"
            onValueChange={onEmployee}
            options={options}
            placeholder={employees.isLoading ? "Loading employees…" : "Type a name or badge number..."}
            value={employeeId}
          />
        )}
        {!deployment ? <p className="text-[10px] font-normal text-slate-500">Search active station personnel by full name or badge ID.</p> : null}
        <FieldError message={errors.employeeId} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-location" required>Location</StaffLabel>
          <StaffInput defaultValue={deployment?.location ?? ""} id="deployment-location" maxLength={200} name="location" placeholder="e.g. Greenhills Sector" />
          <FieldError message={errors.location} />
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-type" required>Deployment Type</StaffLabel>
          <StaffSelect defaultValue={deployment?.deployment_type ?? ""} id="deployment-type" name="deploymentType">
            <option disabled value="">Select deployment type</option>
            {DEPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </StaffSelect>
          <FieldError message={errors.deploymentType} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-event" required>Event / Operation</StaffLabel>
          <StaffSelect defaultValue={deployment?.event_operation ?? ""} id="deployment-event" name="eventOperation">
            <option disabled value="">Select event / operation</option>
            {EVENT_OPERATIONS.map((event) => <option key={event} value={event}>{event}</option>)}
          </StaffSelect>
          <FieldError message={errors.eventOperation} />
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-status" required>Status</StaffLabel>
          <StaffSelect defaultValue={deployment?.status ?? "scheduled"} id="deployment-status" name="status">
            {DEPLOYMENT_STATUSES.filter((status) => status !== "cancelled" || deployment?.status === "cancelled").map((status) => <option key={status} value={status}>{DEPLOYMENT_STATUS[status].label}</option>)}
          </StaffSelect>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-starts" required>Start Date</StaffLabel>
          <StaffInput defaultValue={deployment?.starts_on ?? ""} id="deployment-starts" name="startsOn" type="date" />
          <FieldError message={errors.startsOn} />
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-ends">End Date</StaffLabel>
          <StaffInput defaultValue={deployment?.ends_on ?? ""} id="deployment-ends" name="endsOn" type="date" />
          <p className="text-[10px] font-normal text-slate-500">Optional. Leave blank for ongoing duty.</p>
          <FieldError message={errors.endsOn} />
        </div>
      </div>
      {/* Unit / Assignment is no longer asked for; an existing value is carried through unchanged. */}
      {deployment?.unit ? <input name="unit" type="hidden" value={deployment.unit} /> : null}
      <div className="space-y-1">
        <StaffLabel htmlFor="deployment-notes" required>Remarks / Instructions</StaffLabel>
        <StaffTextarea defaultValue={deployment?.notes ?? ""} id="deployment-notes" maxLength={2000} name="notes" placeholder="Enter special tactical instructions or deployment notes..." rows={3} />
        <FieldError message={errors.notes} />
      </div>
    </>
  );
}

/** Create or edit a deployment in place (Capstone UI dep.html side panel, PDF p. 25). */
export function DeploymentPanel({ mode, onClose }: { mode: DeploymentPanelMode | null; onClose: () => void }) {
  const editing = mode?.kind === "edit" ? mode.id : "";
  const existing = useDeployment(editing);
  const create = useCreateDeployment();
  const update = useUpdateDeployment();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;
  const current: Deployment | undefined = editing ? (existing.data ?? undefined) : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = deploymentInputSchema.safeParse({ ...values, employeeId: current?.employee_id ?? employeeId ?? "", endsOn: typeof values.endsOn === "string" && values.endsOn ? values.endsOn : null });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= key === "employeeId" ? "Choose an employee." : issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      if (current) await update.mutateAsync({ ...parsed.data, id: current.id, expectedUpdatedAt: current.updated_at });
      else await create.mutateAsync(parsed.data);
      notifyStaff({ title: "Deployment saved" });
      setEmployeeId(null);
      onClose();
    } catch (cause) {
      notifyStaff({ title: "Could not save deployment", description: cause instanceof Error ? cause.message : undefined, tone: "error" });
    }
  }

  const missing = Boolean(editing) && !existing.isLoading && (existing.error || !current);
  return (
    <StaffSlideOver
      footer={missing ? <button className={staffButton.secondary} onClick={onClose} type="button">Close</button> : (
        <>
          <button className={staffButton.secondary} onClick={onClose} type="button">Cancel</button>
          <button className={staffButton.primary} disabled={pending || (Boolean(editing) && !current)} form={FORM_ID} type="submit">{pending ? "Saving…" : "Save"}</button>
        </>
      )}
      onClose={onClose}
      open={mode !== null}
      subtitle="Assign an employee to a duty location and operation."
      title={editing ? "Edit Deployment" : "Create Deployment"}
    >
      {editing && existing.isLoading ? <LoadingState label="Loading deployment…" /> : missing ? (
        <p className="text-xs font-semibold text-slate-600">This deployment could not be found.</p>
      ) : (
        <form className="space-y-4" id={FORM_ID} key={current?.id ?? "new"} noValidate onSubmit={submit}>
          <DeploymentFields deployment={current} employeeId={employeeId} errors={errors} onEmployee={(value) => { setEmployeeId(value); setErrors((previous) => ({ ...previous, employeeId: "" })); }} />
        </form>
      )}
    </StaffSlideOver>
  );
}
