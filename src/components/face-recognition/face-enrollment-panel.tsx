"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { useAttendanceEmployees } from "@/hooks/use-attendance-integration";
import { useFaceEnrollmentCapture } from "@/hooks/use-face-enrollment-capture";
import { useDeleteFaceEnrollment, useFaceEnrollments } from "@/hooks/use-face-recognition";
import { FACE_RECOGNITION_CONFIG } from "@/lib/face-recognition/config";

import { CameraViewport } from "./camera-viewport";

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function FaceEnrollmentPanel() {
  const employees = useAttendanceEmployees();
  const enrollments = useFaceEnrollments();
  const capture = useFaceEnrollmentCapture();
  const remove = useDeleteFaceEnrollment();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const employeeOptions = useMemo<ComboboxOption[]>(
    () => (employees.data ?? []).map((employee) => ({ value: employee.id, label: `${employee.first_name} ${employee.last_name}`, description: employee.employee_number })),
    [employees.data],
  );
  const enrollmentByEmployee = useMemo(() => new Map((enrollments.data ?? []).map((row) => [row.employee_id, row])), [enrollments.data]);

  if (employees.isLoading || enrollments.isLoading) return <LoadingState label="Loading personnel and face registrations…" />;
  if (employees.error || enrollments.error) return <ErrorState message={(employees.error ?? enrollments.error)?.message ?? "Unable to load face registrations."} />;

  const { state } = capture;
  const capturing = state.phase === "initializing" || state.phase === "capturing" || state.phase === "submitting";
  const selected = employeeOptions.find((option) => option.value === employeeId) ?? null;
  const existing = employeeId ? enrollmentByEmployee.get(employeeId) : undefined;
  const required = FACE_RECOGNITION_CONFIG.enrollment.requiredSamples;

  function selectEmployee(value: string | null) {
    setEmployeeId(value);
    setConsent(false);
    setConfirmingDelete(false);
    setNotice(null);
    setDeleteError(null);
    capture.cancel();
  }

  function startCapture() {
    if (!employeeId || !consent) return;
    setNotice(null);
    setDeleteError(null);
    capture.begin({ employeeId, consentConfirmed: true });
  }

  async function deleteRegistration() {
    if (!employeeId) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(employeeId);
      setNotice(`Face registration deleted for ${selected?.label ?? "the employee"}.`);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "The face registration could not be deleted.");
    } finally {
      setConfirmingDelete(false);
    }
  }

  const captureMessage =
    state.phase === "initializing" ? "Loading face models and starting the camera…"
      : state.phase === "capturing" ? state.guidance ?? `Hold still — sample ${state.samples} of ${required}`
        : state.phase === "submitting" ? "Saving the face registration…"
          : null;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:max-w-md">
        <FormField description="Only the employee you select here can be registered." htmlFor="face-enrollment-employee" label="Employee">
          <Combobox
            disabled={capturing}
            emptyMessage="No employees match that name or badge number."
            id="face-enrollment-employee"
            onValueChange={selectEmployee}
            options={employeeOptions}
            placeholder="Type a name or badge number"
            value={employeeId}
          />
        </FormField>

        {selected ? (
          <p className="text-sm text-muted-foreground" role="status">
            {existing ? `Registered ${dateFormatter.format(new Date(existing.updated_at))} from ${existing.sample_count} samples.` : "No face registered yet."}
          </p>
        ) : null}

        {selected ? (
          <label className="flex items-start gap-2 text-sm">
            <input checked={consent} className="mt-0.5 size-4" disabled={capturing} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
            <span>{selected.label} has given informed consent to store a face template for attendance. Use only consenting people or test subjects.</span>
          </label>
        ) : null}

        {selected && !capturing ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!consent} onClick={startCapture} type="button">{existing ? "Re-register face" : "Start face registration"}</Button>
            {existing && !confirmingDelete ? <Button onClick={() => setConfirmingDelete(true)} type="button" variant="outline">Delete registration</Button> : null}
            {existing && confirmingDelete ? (
              <>
                <Button disabled={remove.isPending} onClick={() => void deleteRegistration()} type="button" variant="destructive">{remove.isPending ? "Deleting…" : "Confirm delete"}</Button>
                <Button disabled={remove.isPending} onClick={() => setConfirmingDelete(false)} type="button" variant="ghost">Keep registration</Button>
              </>
            ) : null}
          </div>
        ) : null}
        {existing && selected && !capturing ? <p className="text-xs text-muted-foreground">Re-registering keeps the current registration until the new one is saved.</p> : null}
      </div>

      {capturing ? (
        <div className="space-y-3">
          <CameraViewport label={`Camera preview for registering ${selected?.label ?? "the employee"}`} live={state.phase !== "initializing"} tone={state.phase === "capturing" && state.guidance ? "error" : "active"} videoRef={capture.videoRef}>
            <span aria-live="polite" role="status">{captureMessage}</span>
          </CameraViewport>
          <div className="flex justify-center">
            <Button disabled={state.phase === "submitting"} onClick={capture.cancel} type="button" variant="outline">Cancel</Button>
          </div>
        </div>
      ) : null}

      {state.phase === "success" ? (
        <p className="rounded-xl border border-emerald-600/30 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" role="status">
          {state.status === "re_registered" ? "Face re-registered" : "Face registered"} for {selected?.label ?? "the employee"}.
        </p>
      ) : null}
      {state.phase === "error" ? (
        <div className="space-y-2">
          <ErrorState message={state.message} />
          <Button disabled={!consent} onClick={startCapture} type="button" variant="outline">Try again</Button>
        </div>
      ) : null}
      {notice ? <p className="text-sm font-medium text-primary" role="status">{notice}</p> : null}
      {deleteError ? <ErrorState message={deleteError} /> : null}
    </section>
  );
}
