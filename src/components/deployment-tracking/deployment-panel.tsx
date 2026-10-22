"use client";

import { type FormEvent, useMemo, useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffInput, StaffLabel, StaffSelect } from "@/components/staff-shell/ui/staff-fields";
import { StaffSlideOver } from "@/components/staff-shell/ui/staff-slide-over";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { LoadingState } from "@/components/ui/loading-state";
import { useCreateDeploymentGroup, useDeployment, useEmployeeOptions, useEmployeesOnLeave, useUpdateDeployment } from "@/hooks/use-deployment-tracking";
import { DEPLOYMENT_STATUS } from "@/lib/staff/status-maps";
import { deploymentEmployeeName, type DeploymentWithEmployee, type EmployeeOption } from "@/queries/deployment-tracking";
import { DEPLOYMENT_TASKS, DEPLOYMENT_TYPES, DEPLOYMENT_TYPE_EVENTS, deploymentGroupInputSchema, deploymentInputSchema, eventMatchesDeploymentType } from "@/schemas/deployment-tracking";

export type DeploymentPanelMode = { kind: "create" } | { kind: "edit"; id: string };

type DeploymentType = (typeof DEPLOYMENT_TYPES)[number];

const FORM_ID = "deployment-panel-form";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-[10px] font-bold text-rose-500">{message}</p> : null;
}

function isDeploymentType(value: string | null | undefined): value is DeploymentType {
  return Boolean(value) && (DEPLOYMENT_TYPES as readonly string[]).includes(value as string);
}

/** Deployment type and the event / operation choices that belong to it (used by create and edit). */
function TypeAndEventFields({ errors, initialType, initialEvent }: { errors: Record<string, string>; initialType?: string | null; initialEvent?: string | null }) {
  const [deploymentType, setDeploymentType] = useState<DeploymentType | "">(isDeploymentType(initialType) ? initialType : "");
  // A legacy event that no longer belongs to the type must be chosen again.
  const [eventOperation, setEventOperation] = useState(eventMatchesDeploymentType(initialType, initialEvent) ? (initialEvent ?? "") : "");
  const eventOptions = deploymentType ? DEPLOYMENT_TYPE_EVENTS[deploymentType] : [];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <StaffLabel htmlFor="deployment-type" required>Deployment Type</StaffLabel>
        <StaffSelect id="deployment-type" name="deploymentType" onChange={(event) => { setDeploymentType(event.target.value as DeploymentType | ""); setEventOperation(""); }} value={deploymentType}>
          <option disabled value="">Select deployment type</option>
          {DEPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </StaffSelect>
        <FieldError message={errors.deploymentType} />
      </div>
      <div className="space-y-1">
        <StaffLabel htmlFor="deployment-event" required>Event / Operation</StaffLabel>
        <StaffSelect disabled={!deploymentType} id="deployment-event" name="eventOperation" onChange={(event) => setEventOperation(event.target.value)} value={eventOperation}>
          <option disabled value="">{deploymentType ? "Select event / operation" : "Choose a deployment type first"}</option>
          {eventOptions.map((event) => <option key={event} value={event}>{event}</option>)}
        </StaffSelect>
        <FieldError message={errors.eventOperation} />
      </div>
    </div>
  );
}

function DeploymentFields({ deployment, errors }: { deployment: DeploymentWithEmployee; errors: Record<string, string> }) {
  const name = deploymentEmployeeName(deployment.employee);
  const status = DEPLOYMENT_STATUS[deployment.status];
  return (
    <>
      <div className="space-y-1">
        <StaffLabel htmlFor="deployment-employee">Employee</StaffLabel>
        <p className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-700" id="deployment-employee">
          {deployment.employee?.rank?.code ? <span className="mr-1 font-bold">{deployment.employee.rank.code}</span> : null}
          {name ?? "Assigned employee"}
          {deployment.employee ? <span className="ml-2 font-mono text-[10px] text-slate-500">Badge: {deployment.employee.employee_number}</span> : null}
        </p>
        <p className="text-[10px] font-normal text-slate-500">Status: {status.label}. The employee updates the status with proof; HR approves it or cancels the deployment.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-location" required>Location</StaffLabel>
          <StaffInput defaultValue={deployment.location ?? ""} id="deployment-location" maxLength={200} name="location" placeholder="e.g. Greenhills Sector" />
          <FieldError message={errors.location} />
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-task" required>Task</StaffLabel>
          <StaffSelect defaultValue={deployment.task ?? "Deployed"} id="deployment-task" name="task">
            {DEPLOYMENT_TASKS.map((task) => <option key={task} value={task}>{task}</option>)}
          </StaffSelect>
          <FieldError message={errors.task} />
        </div>
      </div>
      <TypeAndEventFields errors={errors} initialEvent={deployment.event_operation} initialType={deployment.deployment_type} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-starts" required>Start Date</StaffLabel>
          <StaffInput defaultValue={deployment.starts_on} id="deployment-starts" name="startsOn" type="date" />
          <FieldError message={errors.startsOn} />
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-ends">End Date</StaffLabel>
          <StaffInput defaultValue={deployment.ends_on ?? ""} id="deployment-ends" name="endsOn" type="date" />
          <p className="text-[10px] font-normal text-slate-500">Optional. Leave blank for ongoing duty.</p>
          <FieldError message={errors.endsOn} />
        </div>
      </div>
    </>
  );
}

type Assignment = { employeeId: string; task: (typeof DEPLOYMENT_TASKS)[number] };
type Availability = "available" | "on-leave";

function employeeDescription(employee: EmployeeOption) {
  return [employee.rank, `Badge ${employee.employeeNumber}`, employee.department].filter(Boolean).join(" · ");
}

function DeploymentGroupFields({ assignments, errors, onAssignments }: { assignments: Assignment[]; errors: Record<string, string>; onAssignments: (assignments: Assignment[]) => void }) {
  const employees = useEmployeeOptions();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [rank, setRank] = useState("");
  const [department, setDepartment] = useState("");
  const [availability, setAvailability] = useState<Availability>("available");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const onLeave = useEmployeesOnLeave(startsOn || null, endsOn || null);
  const onLeaveIds = useMemo(() => new Set(onLeave.data ?? []), [onLeave.data]);
  const employeeById = useMemo(() => new Map((employees.data ?? []).map((employee) => [employee.id, employee])), [employees.data]);
  const rankOptions = useMemo(() => {
    const ranks = new Map<string, number>();
    for (const employee of employees.data ?? []) if (employee.rank) ranks.set(employee.rank, employee.rankSortOrder ?? Number.MAX_SAFE_INTEGER);
    return [...ranks].sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0])).map(([code]) => code);
  }, [employees.data]);
  const departmentOptions = useMemo(() => [...new Set((employees.data ?? []).flatMap((employee) => employee.department ? [employee.department] : []))].sort((left, right) => left.localeCompare(right)), [employees.data]);
  const filtered = useMemo(() => (employees.data ?? [])
    .filter((employee) => !assignments.some((assignment) => assignment.employeeId === employee.id))
    .filter((employee) => (!rank || employee.rank === rank) && (!department || employee.department === department)), [assignments, department, employees.data, rank]);
  const options = useMemo<ComboboxOption[]>(() => filtered
    .filter((employee) => !onLeaveIds.has(employee.id))
    .map((employee) => ({ value: employee.id, label: employee.fullName, description: employeeDescription(employee) })), [filtered, onLeaveIds]);
  const onLeaveEmployees = filtered.filter((employee) => onLeaveIds.has(employee.id));
  const loading = employees.isLoading || onLeave.isLoading;
  const selectClassName = "text-xs";

  return (
    <>
      <div className="space-y-1">
        <StaffLabel htmlFor="deployment-employees" required>Employees</StaffLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StaffSelect aria-label="Filter by rank" className={selectClassName} onChange={(event) => setRank(event.target.value)} value={rank}>
            <option value="">All ranks</option>
            {rankOptions.map((code) => <option key={code} value={code}>{code}</option>)}
          </StaffSelect>
          <StaffSelect aria-label="Filter by unit or section" className={selectClassName} onChange={(event) => setDepartment(event.target.value)} value={department}>
            <option value="">All units / sections</option>
            {departmentOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </StaffSelect>
          <StaffSelect aria-label="Availability" className={selectClassName} onChange={(event) => setAvailability(event.target.value as Availability)} value={availability}>
            <option value="available">Available personnel</option>
            <option value="on-leave">On leave</option>
          </StaffSelect>
        </div>
        {availability === "available" ? (
          <>
            <Combobox
              aria-label="Employees"
              className="rounded-xl border-slate-200 bg-slate-50"
              disabled={loading}
              emptyMessage="No available personnel match these filters."
              id="deployment-employees"
              inputClassName="text-xs font-medium text-slate-900 placeholder:text-slate-400"
              onValueChange={(value) => {
                setEmployeeId(null);
                if (!value || assignments.some((assignment) => assignment.employeeId === value)) return;
                onAssignments([...assignments, { employeeId: value, task: "Deployed" }]);
              }}
              options={options}
              placeholder={loading ? "Loading employees…" : "Type a name or badge number..."}
              value={employeeId}
            />
            <p className="text-[10px] font-normal text-slate-500">Select one or more active personnel by name or badge number. Personnel on approved leave {startsOn ? "during these dates" : "today"} are not listed.</p>
          </>
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] font-normal text-slate-500">Personnel on approved leave {startsOn ? "during these dates" : "today"} cannot be deployed.</p>
            {onLeaveEmployees.length ? (
              <ul aria-label="Personnel on leave" className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {onLeaveEmployees.map((employee) => (
                  <li className="flex cursor-not-allowed flex-wrap items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-400" key={employee.id}>
                    <span className="flex-1 font-semibold">{employee.fullName}<span className="ml-2 font-normal">{employeeDescription(employee)}</span></span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">On leave</span>
                  </li>
                ))}
              </ul>
            ) : <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">{loading ? "Loading…" : "No personnel on leave match these filters."}</p>}
          </div>
        )}
        <FieldError message={errors.assignments} />
        {assignments.length ? <ul aria-label="Selected employees" className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {assignments.map((assignment) => {
            const employee = employeeById.get(assignment.employeeId);
            const name = employee?.fullName ?? "Selected employee";
            return <li className="flex flex-wrap items-center gap-2" key={assignment.employeeId}>
              <span className="min-w-40 flex-1 text-xs text-slate-800">
                {employee?.rank ? <span className="mr-1 font-bold text-slate-900">{employee.rank}</span> : null}
                <span className="font-semibold">{name}</span>
                {employee ? <span className="ml-2 font-mono text-[10px] text-slate-500">Badge: {employee.employeeNumber}</span> : null}
                {onLeaveIds.has(assignment.employeeId) ? <span className="ml-2 text-[10px] font-bold text-rose-600">On leave for these dates</span> : null}
              </span>
              <StaffSelect aria-label={`Task for ${name}`} className="w-40" onChange={(event) => onAssignments(assignments.map((item) => item.employeeId === assignment.employeeId ? { ...item, task: event.target.value as Assignment["task"] } : item))} value={assignment.task}>
                {DEPLOYMENT_TASKS.map((task) => <option key={task} value={task}>{task}</option>)}
              </StaffSelect>
              <button aria-label={`Remove ${name}`} className="rounded-md px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={() => onAssignments(assignments.filter((item) => item.employeeId !== assignment.employeeId))} type="button">Remove</button>
            </li>;
          })}
        </ul> : null}
      </div>
      <div className="space-y-1">
        <StaffLabel htmlFor="deployment-location" required>Location</StaffLabel>
        <StaffInput id="deployment-location" maxLength={200} name="location" placeholder="e.g. Greenhills Sector" />
        <FieldError message={errors.location} />
      </div>
      <TypeAndEventFields errors={errors} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-starts" required>Start Date</StaffLabel>
          <StaffInput id="deployment-starts" name="startsOn" onChange={(event) => setStartsOn(event.target.value)} type="date" value={startsOn} />
          <FieldError message={errors.startsOn} />
        </div>
        <div className="space-y-1">
          <StaffLabel htmlFor="deployment-ends">End Date</StaffLabel>
          <StaffInput id="deployment-ends" name="endsOn" onChange={(event) => setEndsOn(event.target.value)} type="date" value={endsOn} />
          <p className="text-[10px] font-normal text-slate-500">Optional. Leave blank for ongoing duty.</p>
          <FieldError message={errors.endsOn} />
        </div>
      </div>
    </>
  );
}

/** Create or edit a deployment in place (Capstone UI dep.html side panel, PDF p. 25). */
export function DeploymentPanel({ mode, onClose }: { mode: DeploymentPanelMode | null; onClose: () => void }) {
  const editing = mode?.kind === "edit" ? mode.id : "";
  const existing = useDeployment(editing);
  const createGroup = useCreateDeploymentGroup();
  const update = useUpdateDeployment();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const pending = createGroup.isPending || update.isPending;
  const current: DeploymentWithEmployee | undefined = editing ? (existing.data ?? undefined) : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const endsOn = typeof values.endsOn === "string" && values.endsOn ? values.endsOn : null;
    const parsed = current
      ? deploymentInputSchema.safeParse({ ...values, endsOn })
      : deploymentGroupInputSchema.safeParse({ ...values, assignments, endsOn });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      if (current) await update.mutateAsync({ ...parsed.data, id: current.id, expectedUpdatedAt: current.updated_at });
      else await createGroup.mutateAsync(parsed.data);
      notifyStaff({ title: "Deployment saved" });
      setAssignments([]);
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
      subtitle={editing ? "Update the duty location, operation, dates and task." : "Assign one or more employees to a duty location and operation."}
      title={editing ? "Edit Deployment" : "Create Deployment"}
    >
      {editing && existing.isLoading ? <LoadingState label="Loading deployment…" /> : missing ? (
        <p className="text-xs font-semibold text-slate-600">This deployment could not be found.</p>
      ) : (
        <form className="space-y-4" id={FORM_ID} key={current?.id ?? "new"} noValidate onSubmit={submit}>
          {current ? <DeploymentFields deployment={current} errors={errors} /> : <DeploymentGroupFields assignments={assignments} errors={errors} onAssignments={(next) => { setAssignments(next); setErrors((previous) => ({ ...previous, assignments: "" })); }} />}
        </form>
      )}
    </StaffSlideOver>
  );
}
