"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployee, usePersonnelEntries, useSavePersonnelEntry } from "@/hooks/use-personnel-records";
import type { PersonnelKind } from "@/queries/personnel-records";

import { EmployeeEditor } from "./employee-editor";
import { RecordEntryForm } from "./record-entry-form";

const kinds: PersonnelKind[] = ["serviceHistory", "qualification", "certification", "training"];
const titles: Record<PersonnelKind, string> = { serviceHistory: "Service history", qualification: "Qualifications", certification: "Certifications", training: "Training" };

function Records({ employeeId, kind }: { employeeId: string; kind: PersonnelKind }) {
  const entries = usePersonnelEntries(kind, employeeId); const save = useSavePersonnelEntry(kind, employeeId);
  if (entries.isLoading) return <LoadingState label={`Loading ${titles[kind].toLowerCase()}…`} />;
  if (entries.error) return <ErrorState message={entries.error.message} />;
  return <section className="rounded-xl border p-4"><h2 className="text-lg font-semibold">{titles[kind]}</h2><ul className="mt-3 space-y-2 text-sm">{entries.data?.length ? entries.data.map((entry) => <li className="rounded-lg bg-muted px-3 py-2" key={entry.id}>{"name" in entry ? entry.name : "course_name" in entry ? entry.course_name : entry.employment_title ?? "Service entry"}</li>) : <li className="text-muted-foreground">No {titles[kind].toLowerCase()} recorded.</li>}</ul><RecordEntryForm employeeId={employeeId} kind={kind} onSaved={async (input) => { await save.mutateAsync({ input: input as never }); }} pending={save.isPending} /></section>;
}

export function EmployeeRecordDetail({ employeeId }: { employeeId: string }) {
  const employee = useEmployee(employeeId);
  if (employee.isLoading) return <LoadingState label="Loading employee record…" />;
  if (employee.error || !employee.data) return <ErrorState message={employee.error?.message ?? "Employee record was not found."} />;
  return <div className="space-y-8"><div><Link className="text-sm text-primary underline-offset-4 hover:underline" href="/hr/employees">Back to employees</Link><h1 className="mt-3 text-3xl font-semibold tracking-tight">{employee.data.first_name} {employee.data.last_name}</h1><p className="mt-1 text-muted-foreground">{employee.data.employee_number} · {employee.data.employment_status.replace("_", " ")}</p></div><section><h2 className="mb-4 text-xl font-semibold">Official record</h2><EmployeeEditor employee={employee.data} /></section>{kinds.map((kind) => <Records employeeId={employeeId} key={kind} kind={kind} />)}</div>;
}
