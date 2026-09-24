"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { useAttendanceEmployees, useResolveUnmatchedAttendanceEvent, useUnmatchedAttendanceEvents } from "@/hooks/use-attendance-integration";

export function UnmatchedAttendanceQueue() {
  const events = useUnmatchedAttendanceEvents({ page: 1, pageSize: 25 });
  const employees = useAttendanceEmployees();
  const resolve = useResolveUnmatchedAttendanceEvent();
  const [selected, setSelected] = useState<Record<string, string | null>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const employeeOptions = useMemo<ComboboxOption[]>(
    () => (employees.data ?? []).map((employee) => ({ value: employee.id, label: `${employee.first_name} ${employee.last_name}`, description: employee.employee_number })),
    [employees.data],
  );

  if (events.isLoading || employees.isLoading) return <LoadingState label="Loading unmatched attendance events…" />;
  if (events.error || employees.error) return <ErrorState message={(events.error ?? employees.error)?.message ?? "Unable to load attendance events."} />;
  const rows = events.data?.rows ?? [];

  async function mapEvent(eventId: string, externalEmployeeId: string) {
    const employeeId = selected[eventId];
    if (!employeeId) return;
    setSuccess(null);
    setRowErrors((current) => ({ ...current, [eventId]: "" }));
    setPendingId(eventId);
    try {
      await resolve.mutateAsync({ unmatchedEventId: eventId, employeeId, externalEmployeeId });
      const employee = employeeOptions.find((option) => option.value === employeeId);
      setSuccess(`Mapped ${externalEmployeeId} to ${employee?.label ?? "the selected employee"}.`);
    } catch (cause) {
      setRowErrors((current) => ({ ...current, [eventId]: cause instanceof Error ? cause.message : "Unable to map this attendance event." }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-3">
      {success ? <p className="rounded-xl border border-emerald-600/30 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" role="status">{success}</p> : null}
      {rows.length ? rows.map((event) => {
        const isPending = pendingId === event.id;
        return (
          <article className="rounded-xl border p-4" key={event.id}>
            <p className="font-medium">{event.external_employee_id}</p>
            <p className="mt-1 text-sm text-muted-foreground">{event.attendance_date} · {event.source_event_id}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-start">
              <FormField error={rowErrors[event.id] || undefined} htmlFor={`employee-${event.id}`} label={`Employee for ${event.external_employee_id}`}>
                <Combobox
                  disabled={isPending}
                  emptyMessage="No employees match that name or badge number."
                  id={`employee-${event.id}`}
                  onValueChange={(value) => setSelected((current) => ({ ...current, [event.id]: value }))}
                  options={employeeOptions}
                  placeholder="Type a name or badge number"
                  value={selected[event.id] ?? null}
                />
              </FormField>
              <Button className="sm:mt-8" disabled={!selected[event.id] || pendingId !== null} onClick={() => void mapEvent(event.id, event.external_employee_id)} type="button">
                {isPending ? "Mapping…" : "Map and resolve"}
              </Button>
            </div>
          </article>
        );
      }) : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No unmatched attendance events. New unknown device IDs appear here after an import.</p>}
    </section>
  );
}
