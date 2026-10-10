"use client";

import { type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Pagination } from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import { useLeaveTypes, useSetLeaveTypeAllotment, useUpdateLeaveType } from "@/hooks/use-leave-management";
import type { LeaveType } from "@/lib/types/database";
import { leaveTypeAllotmentSchema } from "@/schemas/leave-management";

export function LeaveTypeSummary({ name }: { name: string }) {
  return <span>{name}</span>;
}

/** "2 days a year", "7 days a year · extra days deducted from retirement benefits", or "No yearly limit". */
export function allotmentLabel(type: Pick<LeaveType, "days_per_year" | "excess_deducted_from_retirement">) {
  if (type.days_per_year === null) return "No yearly limit";
  const days = `${type.days_per_year} ${type.days_per_year === 1 ? "day" : "days"} a year`;
  return type.excess_deducted_from_retirement ? `${days} · extra days deducted from retirement benefits` : days;
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function EditLeaveTypeForm({ onDone, type }: { onDone: (message: string) => void; type: LeaveType }) {
  const update = useUpdateLeaveType();
  const setAllotment = useSetLeaveTypeAllotment();
  const [error, setError] = useState<string | null>(null);
  const saving = update.isPending || setAllotment.isPending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const daysText = String(data.get("daysPerYear") ?? "").trim();
    const allotment = leaveTypeAllotmentSchema.safeParse({
      id: type.id,
      daysPerYear: daysText ? Number(daysText) : null,
      excessDeductedFromRetirement: data.get("excessDeducted") === "on",
    });
    if (!allotment.success) {
      setError(allotment.error.issues[0]?.message ?? "Enter valid days per year.");
      return;
    }
    try {
      await update.mutateAsync({
        id: type.id,
        name: String(data.get("name")),
        description: String(data.get("description")),
        // Evidence is no longer asked for on leave types; an existing setting is kept as it was.
        requiresAttachment: type.requires_attachment,
        isActive: type.is_active,
      });
      await setAllotment.mutateAsync(allotment.data);
      onDone(`${String(data.get("name"))} was updated.`);
    } catch (cause) {
      setError(errorMessage(cause, "Unable to update the leave type."));
    }
  }

  return (
    <form className="mt-3 grid gap-3 sm:grid-cols-2" noValidate onSubmit={submit}>
      <FormField htmlFor={`type-name-${type.id}`} label="Name" required>
        <Input defaultValue={type.name} id={`type-name-${type.id}`} name="name" required />
      </FormField>
      <FormField htmlFor={`type-description-${type.id}`} label="Description">
        <Textarea defaultValue={type.description ?? ""} id={`type-description-${type.id}`} name="description" rows={2} />
      </FormField>
      <FormField description="Leave blank for no limit. Employees cannot request more once these days are used." htmlFor={`type-days-${type.id}`} label="Days per year">
        <Input defaultValue={type.days_per_year ?? ""} id={`type-days-${type.id}`} inputMode="numeric" max={366} min={1} name="daysPerYear" type="number" />
      </FormField>
      <label className="flex min-h-11 items-start gap-2 text-sm sm:pt-7" htmlFor={`type-excess-${type.id}`}>
        <input className="mt-0.5 size-4" defaultChecked={type.excess_deducted_from_retirement} id={`type-excess-${type.id}`} name="excessDeducted" type="checkbox" />
        <span>Allow extra days beyond the limit, deducted from retirement benefits</span>
      </label>
      {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
      <Button className="sm:w-fit" disabled={saving} type="submit" variant="secondary">{saving ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}

export function LeaveTypeManager({ onPageChange, page = 1 }: { onPageChange?: (page: number) => void; page?: number } = {}) {
  const types = useLeaveTypes({ page, pageSize: 10 });
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (types.isLoading) return <LoadingState label="Loading leave types…" />;
  if (types.error) return <ErrorState message={types.error.message} />;

  return (
    <section aria-labelledby="leave-types-heading" className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight" id="leave-types-heading">Leave types</h2>
        <p className="text-sm text-muted-foreground">Update a leave type&apos;s name, description, or yearly days. Leave types cannot be added or removed.</p>
      </div>
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      {types.data?.rows.length ? (
        <ul className="space-y-2">
          {types.data.rows.map((type) => (
            <li className="rounded-lg border bg-background px-4 py-3" key={type.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{type.name}</span>
                  <Badge variant={type.is_active ? "secondary" : "outline"}>{type.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                <Button aria-expanded={editingId === type.id} aria-label={`Update ${type.name}`} onClick={() => setEditingId(editingId === type.id ? null : type.id)} size="sm" type="button" variant="outline">Update</Button>
              </div>
              <p className="mt-1 text-sm">{allotmentLabel(type)}</p>
              {type.description ? <p className="mt-1 text-sm text-muted-foreground">{type.description}</p> : null}
              {editingId === type.id ? <EditLeaveTypeForm onDone={(message) => { setNotice(message); setEditingId(null); }} type={type} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">No leave types are set up.</p>
      )}
      {onPageChange && types.data ? <Pagination from={types.data.rows.length ? (page - 1) * 10 + 1 : 0} noun="leave types" onPageChange={onPageChange} page={page} pageCount={Math.max(1, Math.ceil(types.data.count / 10))} to={Math.min(page * 10, types.data.count)} total={types.data.count} /> : null}
    </section>
  );
}
