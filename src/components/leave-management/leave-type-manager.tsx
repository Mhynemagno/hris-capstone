"use client";

import { type FormEvent, useState } from "react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useCreateLeaveType, useLeaveTypes, useUpdateLeaveType } from "@/hooks/use-leave-management";
import type { LeaveType } from "@/lib/types/database";

export function LeaveTypeSummary({ name, requiresAttachment }: { name: string; requiresAttachment: boolean }) {
  return (
    <span>
      {name}
      {requiresAttachment ? <span className="ml-2 text-xs text-muted-foreground">Evidence required</span> : null}
    </span>
  );
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function EditLeaveTypeForm({ onDone, type }: { onDone: (message: string) => void; type: LeaveType }) {
  const update = useUpdateLeaveType();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      await update.mutateAsync({
        id: type.id,
        name: String(data.get("name")),
        description: String(data.get("description")),
        requiresAttachment: data.get("requiresAttachment") === "on",
        isActive: type.is_active,
      });
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
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2">
        <input className="size-5 accent-primary" defaultChecked={type.requires_attachment} name="requiresAttachment" type="checkbox" />
        Employees must attach evidence
      </label>
      {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
      <Button className="sm:w-fit" disabled={update.isPending} type="submit" variant="secondary">{update.isPending ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}

export function LeaveTypeManager() {
  const types = useLeaveTypes();
  const create = useCreateLeaveType();
  const update = useUpdateLeaveType();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LeaveType | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError("Enter a name for the leave type.");
      return;
    }
    try {
      await create.mutateAsync({ name, description: String(data.get("description")), requiresAttachment: data.get("requiresAttachment") === "on" });
      formElement.reset();
      setNotice(`${name} was added.`);
    } catch (cause) {
      setError(errorMessage(cause, "Unable to create leave type."));
    }
  }

  async function setActive(type: LeaveType, isActive: boolean) {
    setError(null);
    setNotice(null);
    setTogglingId(type.id);
    try {
      await update.mutateAsync({ id: type.id, name: type.name, description: type.description ?? undefined, requiresAttachment: type.requires_attachment, isActive });
      setNotice(`${type.name} was ${isActive ? "reactivated" : "deactivated"}.`);
    } catch (cause) {
      setError(errorMessage(cause, "Unable to update the leave type."));
      throw cause;
    } finally {
      setTogglingId(null);
    }
  }

  if (types.isLoading) return <LoadingState label="Loading leave types…" />;
  if (types.error) return <ErrorState message={types.error.message} />;

  return (
    <section aria-labelledby="leave-types-heading" className="space-y-4 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold" id="leave-types-heading">Leave types</h2>
        <p className="text-sm text-muted-foreground">Deactivate a type to stop new requests while keeping past requests. Only unused types can be deleted.</p>
      </div>
      <form className="grid gap-3 sm:grid-cols-2" noValidate onSubmit={submit}>
        <FormField htmlFor="type-name" label="Name" required>
          <Input id="type-name" name="name" required />
        </FormField>
        <FormField htmlFor="type-description" label="Description">
          <Input id="type-description" name="description" />
        </FormField>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input className="size-5 accent-primary" name="requiresAttachment" type="checkbox" />
          Employees must attach evidence
        </label>
        <Button className="sm:w-fit sm:justify-self-end" disabled={create.isPending} type="submit">{create.isPending ? "Adding…" : "Add leave type"}</Button>
      </form>
      {error ? <ErrorState message={error} /> : null}
      <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
      {types.data?.length ? (
        <ul className="space-y-2">
          {types.data.map((type) => (
            <li className="rounded-lg border bg-background px-4 py-3" key={type.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{type.name}</span>
                  <Badge variant={type.is_active ? "secondary" : "outline"}>{type.is_active ? "Active" : "Inactive"}</Badge>
                  {type.requires_attachment ? <Badge variant="outline">Evidence required</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    aria-label={`${type.is_active ? "Deactivate" : "Activate"} ${type.name}`}
                    disabled={togglingId === type.id}
                    onClick={() => void setActive(type, !type.is_active).catch(() => undefined)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {togglingId === type.id ? "Saving…" : type.is_active ? "Deactivate type" : "Activate type"}
                  </Button>
                  <Button aria-label={`Delete ${type.name}`} onClick={() => setDeleting(type)} size="sm" type="button" variant="destructive">Delete</Button>
                </div>
              </div>
              {type.description ? <p className="mt-1 text-sm text-muted-foreground">{type.description}</p> : null}
              <details className="mt-2">
                <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">Edit type</summary>
                <EditLeaveTypeForm onDone={setNotice} type={type} />
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">No leave types yet. Add the first one above.</p>
      )}
      <DeleteRecordDialog
        alternative={deleting?.is_active ? { label: "Deactivate instead", onSelect: () => setActive(deleting, false) } : undefined}
        entityId={deleting?.id ?? null}
        entityType="leave_type"
        noun="leave type"
        onClose={() => setDeleting(null)}
        onDeleted={() => setNotice("The leave type was permanently deleted.")}
      />
    </section>
  );
}
