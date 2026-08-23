"use client";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { Deployment } from "@/lib/types/database";
import { deploymentInputSchema, type DeploymentInput } from "@/schemas/deployment-tracking";

export function DeploymentForm({ deployment, onSaved, pending = false }: { deployment?: Deployment; onSaved: (input: DeploymentInput) => Promise<void> | void; pending?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); const values = Object.fromEntries(new FormData(event.currentTarget)); const parsed = deploymentInputSchema.safeParse({ ...values, employeeId: deployment?.employee_id ?? values.employeeId, endsOn: values.endsOn || null }); if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the deployment details."); try { await onSaved(parsed.data); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save deployment."); } }
  return <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={submit}>
    {!deployment ? <FormField htmlFor="employee-id" label="Employee ID"><Input id="employee-id" name="employeeId" required placeholder="Employee UUID" /></FormField> : null}
    <FormField htmlFor="assignment-role" label="Assignment role"><Input id="assignment-role" name="assignmentRole" required defaultValue={deployment?.assignment_role} /></FormField>
    <FormField htmlFor="location" label="Location"><Input id="location" name="location" defaultValue={deployment?.location ?? ""} /></FormField>
    <FormField htmlFor="unit" label="Unit"><Input id="unit" name="unit" defaultValue={deployment?.unit ?? ""} /></FormField>
    <FormField htmlFor="project" label="Project"><Input id="project" name="project" defaultValue={deployment?.project ?? ""} /></FormField>
    <FormField htmlFor="status" label="Status"><select className="h-11 w-full rounded-lg border bg-background px-3" id="status" name="status" defaultValue={deployment?.status ?? "planned"}>{["planned", "active", "completed", "cancelled"].map((status) => <option key={status}>{status}</option>)}</select></FormField>
    <FormField htmlFor="starts-on" label="Start date"><Input id="starts-on" name="startsOn" type="date" required defaultValue={deployment?.starts_on} /></FormField>
    <FormField htmlFor="ends-on" label="End date"><Input id="ends-on" name="endsOn" type="date" defaultValue={deployment?.ends_on ?? ""} /></FormField>
    <FormField htmlFor="notes" label="Notes"><textarea className="min-h-24 w-full rounded-lg border bg-background p-3" id="notes" name="notes" defaultValue={deployment?.notes ?? ""} maxLength={2000} /></FormField>
    {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}<div className="sm:col-span-2"><Button disabled={pending} type="submit">{pending ? "Saving…" : "Save deployment"}</Button></div>
  </form>;
}
