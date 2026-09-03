"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useDeletePersonnelEntry, useEmployee, usePersonnelEntries, useSavePersonnelEntry } from "@/hooks/use-personnel-records";
import type { TrainingRecord } from "@/lib/types/database";
import type { PersonnelKind } from "@/queries/personnel-records";

import { EmployeeEditor } from "./employee-editor";
import { RecordEntryForm } from "./record-entry-form";

const kinds: PersonnelKind[] = ["serviceHistory", "qualification", "certification"];
const titles: Record<PersonnelKind, string> = { serviceHistory: "Service history", qualification: "Qualifications", certification: "Certifications", training: "Training" };

function Records({ employeeId, kind }: { employeeId: string; kind: PersonnelKind }) {
  const entries = usePersonnelEntries(kind, employeeId); const save = useSavePersonnelEntry(kind, employeeId);
  if (entries.isLoading) return <LoadingState label={`Loading ${titles[kind].toLowerCase()}…`} />;
  if (entries.error) return <ErrorState message={entries.error.message} />;
  return <section className="rounded-xl border p-4"><h2 className="text-lg font-semibold">{titles[kind]}</h2><ul className="mt-3 space-y-2 text-sm">{entries.data?.length ? entries.data.map((entry) => <li className="rounded-lg bg-muted px-3 py-2" key={entry.id}>{"name" in entry ? entry.name : "course_name" in entry ? entry.course_name : entry.employment_title ?? "Service entry"}</li>) : <li className="text-muted-foreground">No {titles[kind].toLowerCase()} recorded.</li>}</ul><RecordEntryForm employeeId={employeeId} kind={kind} onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} /></section>;
}

function TrainingRecords({ employeeId }: { employeeId: string }) {
  const [editing, setEditing] = useState<TrainingRecord | null>(null);
  const [deleting, setDeleting] = useState<TrainingRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const entries = usePersonnelEntries("training", employeeId);
  const save = useSavePersonnelEntry("training", employeeId);
  const remove = useDeletePersonnelEntry("training", employeeId);
  const trainings = (entries.data ?? []) as TrainingRecord[];

  async function deleteTraining() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "We could not delete this training record.");
    }
  }

  if (entries.isLoading) return <LoadingState label="Loading training…" />;
  if (entries.error) return <ErrorState message={entries.error.message} />;
  return <section className="rounded-xl border p-4">
    <h2 className="text-lg font-semibold">Training</h2>
    <ul className="mt-3 space-y-2 text-sm">
      {trainings.length ? trainings.map((training) => <li className="flex flex-col gap-3 rounded-lg bg-muted px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={training.id}>
        <div><p className="font-medium">{training.course_name}</p><p className="text-muted-foreground">{training.provider} · {training.completed_on}{training.hours === null ? "" : ` · ${training.hours} hours`}</p></div>
        <div className="flex gap-2"><Button onClick={() => setEditing(training)} size="sm" type="button" variant="outline">Edit</Button><Button onClick={() => { setDeleteError(null); setDeleting(training); }} size="sm" type="button" variant="destructive">Delete</Button></div>
      </li>) : <li className="text-muted-foreground">No training recorded.</li>}
    </ul>
    {deleting ? <div aria-labelledby="delete-training-title" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="dialog">
      <h3 className="font-medium" id="delete-training-title">Delete training record?</h3><p className="mt-1 text-sm text-muted-foreground">This permanently removes “{deleting.course_name}”.</p>
      {deleteError ? <p className="mt-2 text-sm text-destructive" role="alert">{deleteError}</p> : null}
      <div className="mt-3 flex gap-2"><Button disabled={remove.isPending} onClick={() => void deleteTraining()} size="sm" type="button" variant="destructive">{remove.isPending ? "Deleting…" : "Delete training"}</Button><Button disabled={remove.isPending} onClick={() => setDeleting(null)} size="sm" type="button" variant="outline">Cancel</Button></div>
    </div> : null}
    {editing ? <div className="mt-4"><div className="flex items-center justify-between"><h3 className="font-medium">Edit training</h3><Button onClick={() => setEditing(null)} size="sm" type="button" variant="ghost">Cancel edit</Button></div><RecordEntryForm employeeId={employeeId} key={editing.id} kind="training" onSaved={async (input, id) => { await save.mutateAsync({ id, input: input as never }); setEditing(null); }} pending={save.isPending} training={editing} /></div> : <RecordEntryForm employeeId={employeeId} kind="training" onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} />}
  </section>;
}

export function EmployeeRecordDetail({ employeeId }: { employeeId: string }) {
  const employee = useEmployee(employeeId);
  if (employee.isLoading) return <LoadingState label="Loading employee record…" />;
  if (employee.error || !employee.data) return <ErrorState message={employee.error?.message ?? "Employee record was not found."} />;
  return <div className="space-y-8"><div><Link className="text-sm text-primary underline-offset-4 hover:underline" href="/hr/employees">Back to employees</Link><h1 className="mt-3 text-3xl font-semibold tracking-tight">{employee.data.first_name} {employee.data.last_name}</h1><p className="mt-1 text-muted-foreground">{employee.data.employee_number} · {employee.data.employment_status.replace("_", " ")}</p></div><section><h2 className="mb-4 text-xl font-semibold">Official record</h2><EmployeeEditor employee={employee.data} /></section>{kinds.map((kind) => <Records employeeId={employeeId} key={kind} kind={kind} />)}<TrainingRecords employeeId={employeeId} /></div>;
}
