"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useAttendanceSettings, useSaveAttendanceSettings } from "@/hooks/use-attendance-integration";
import type { AttendanceIntegrationSettings as AttendanceIntegrationSettingsRow } from "@/lib/types/database";
import { attendanceSettingsSchema } from "@/schemas/attendance-integration";

/** The CSV/XLSX Edge Function adapter (supabase/functions/_shared/attendance-adapter.ts) only understands template "v1". */
export const SUPPORTED_ATTENDANCE_TEMPLATE_VERSION = "v1";

export function AttendanceIntegrationSettings() {
  const query = useAttendanceSettings();
  if (query.isLoading) return <LoadingState label="Loading attendance settings…" />;
  if (query.error || !query.data) return <ErrorState message={query.error?.message ?? "Attendance settings are unavailable."} />;
  return <SettingsForm key={query.data.updated_at} settings={query.data} />;
}

type SettingsErrors = Partial<Record<"workdayStart" | "lateGraceMinutes", string>>;

function SettingsForm({ settings }: { settings: AttendanceIntegrationSettingsRow }) {
  const save = useSaveAttendanceSettings();
  const [values, setValues] = useState({
    workdayStart: settings.workday_start.slice(0, 5),
    lateGraceMinutes: String(settings.late_grace_minutes),
    isEnabled: settings.is_enabled,
  });
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const input = { ...values, templateVersion: SUPPORTED_ATTENDANCE_TEMPLATE_VERSION };
    const parsed = attendanceSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const next: SettingsErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "workdayStart" && !next.workdayStart) next.workdayStart = "Enter the workday start time (HH:MM).";
        if (key === "lateGraceMinutes" && !next.lateGraceMinutes) next.lateGraceMinutes = "Enter a whole number of minutes from 0 to 120.";
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync(parsed.data);
      setSuccess("Attendance settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save attendance settings.");
    }
  }

  return (
    <section aria-labelledby="attendance-settings-heading" className="max-w-2xl space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="font-semibold" id="attendance-settings-heading">
          CSV/XLSX integration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adapter: {settings.adapter_key}. Timezone: {settings.timezone}. Vendor credentials never belong in browser code.
        </p>
      </div>
      <form className="space-y-4" noValidate onSubmit={submit}>
        <FormField error={errors.workdayStart} htmlFor="attendance-workday-start" label="Workday start" required>
          <Input
            id="attendance-workday-start"
            onChange={(event) => setValues({ ...values, workdayStart: event.target.value })}
            required
            type="time"
            value={values.workdayStart}
          />
        </FormField>
        <FormField
          description="Minutes after the workday start before a time-in counts as late (0–120)."
          error={errors.lateGraceMinutes}
          htmlFor="attendance-late-grace"
          label="Late grace minutes"
          required
        >
          <Input
            id="attendance-late-grace"
            inputMode="numeric"
            max={120}
            min={0}
            onChange={(event) => setValues({ ...values, lateGraceMinutes: event.target.value })}
            required
            step={1}
            type="number"
            value={values.lateGraceMinutes}
          />
        </FormField>
        <dl className="space-y-1">
          <dt className="text-sm font-semibold">Import template version</dt>
          <dd className="text-base font-medium">{SUPPORTED_ATTENDANCE_TEMPLATE_VERSION}</dd>
          <dd className="text-sm text-muted-foreground">
            Fixed by the import service; it is the only template the CSV/XLSX adapter reads.
            {settings.template_version !== SUPPORTED_ATTENDANCE_TEMPLATE_VERSION
              ? ` The stored value “${settings.template_version}” will be corrected to ${SUPPORTED_ATTENDANCE_TEMPLATE_VERSION} when you save.`
              : ""}
          </dd>
        </dl>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            checked={values.isEnabled}
            className="size-4"
            onChange={(event) => setValues({ ...values, isEnabled: event.target.checked })}
            type="checkbox"
          />
          Enable imports
        </label>
        {error ? <ErrorState message={error} /> : null}
        {success ? (
          <p className="text-sm font-medium text-primary" role="status">
            {success}
          </p>
        ) : null}
        <Button disabled={save.isPending} type="submit">
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </form>
      <aside className="rounded-lg bg-muted p-3 text-sm">
        <p className="font-medium">Future biometric vendor checklist</p>
        <p className="mt-1 text-muted-foreground">
          Keep stable external IDs, preserve event semantics and idempotency, document credentials outside the browser, and test the adapter before replacing CSV/XLSX.
        </p>
      </aside>
    </section>
  );
}
