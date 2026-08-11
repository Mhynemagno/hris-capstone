"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { PersonnelKind } from "@/queries/personnel-records";
import { certificationSchema, qualificationSchema, serviceHistorySchema, trainingRecordSchema } from "@/schemas/personnel-records";

const fields: Record<PersonnelKind, { title: string; primary: string; secondary: string; date: string; expiry?: string }> = {
  serviceHistory: { title: "Service history", primary: "Employment title", secondary: "Notes", date: "Start date", expiry: "End date" },
  qualification: { title: "Qualification", primary: "Qualification name", secondary: "Institution", date: "Awarded date" },
  certification: { title: "Certification", primary: "Certificate name", secondary: "Issuer", date: "Issued date", expiry: "Expiry date" },
  training: { title: "Training", primary: "Course name", secondary: "Provider", date: "Completed date", expiry: "Expiry date" },
};

type RecordEntryFormProps = { employeeId: string; kind: PersonnelKind; onSaved: (input: unknown) => void | Promise<void>; pending?: boolean };

export function RecordEntryForm({ employeeId, kind, onSaved, pending = false }: RecordEntryFormProps) {
  const [error, setError] = useState<string | null>(null); const config = fields[kind];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); const form = Object.fromEntries(new FormData(event.currentTarget));
    const base = kind === "serviceHistory" ? { employeeId, employmentTitle: form.primary, notes: form.secondary, startedOn: form.date, endedOn: form.expiry || undefined } : kind === "qualification" ? { employeeId, name: form.primary, institution: form.secondary, awardedOn: form.date } : kind === "certification" ? { employeeId, name: form.primary, issuer: form.secondary, issuedOn: form.date, expiresOn: form.expiry || undefined } : { employeeId, courseName: form.primary, provider: form.secondary, completedOn: form.date, expiresOn: form.expiry || undefined, hours: form.hours || undefined };
    const schema = kind === "serviceHistory" ? serviceHistorySchema : kind === "qualification" ? qualificationSchema : kind === "certification" ? certificationSchema : trainingRecordSchema;
    const parsed = schema.safeParse(base); if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check this record.");
    try { await onSaved(parsed.data); event.currentTarget.reset(); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save this record."); }
  }
  return <form className="mt-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2" noValidate onSubmit={submit}><FormField htmlFor={`${kind}-primary`} label={config.primary}><Input className="h-11" id={`${kind}-primary`} name="primary" required /></FormField><FormField htmlFor={`${kind}-secondary`} label={config.secondary}><Input className="h-11" id={`${kind}-secondary`} name="secondary" required={kind !== "serviceHistory"} /></FormField><FormField htmlFor={`${kind}-date`} label={config.date}><Input className="h-11" id={`${kind}-date`} name="date" type="date" required /></FormField>{config.expiry ? <FormField htmlFor={`${kind}-expiry`} label={config.expiry}><Input className="h-11" id={`${kind}-expiry`} name="expiry" type="date" /></FormField> : null}{kind === "training" ? <FormField htmlFor="training-hours" label="Hours"><Input className="h-11" id="training-hours" min="0" name="hours" type="number" /></FormField> : null}{error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}<div className="sm:col-span-2"><Button className="h-11" disabled={pending} type="submit">{pending ? "Saving…" : `Add ${config.title.toLowerCase()}`}</Button></div></form>;
}
