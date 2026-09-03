"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useSubmitProfileChangeRequest } from "@/hooks/use-profile-change-requests";
import { useEmployeeForCurrentUser, usePersonnelEntries } from "@/hooks/use-personnel-records";
import type { Qualification } from "@/lib/types/database";
import type { ProfileChangeDraftInput } from "@/schemas/profile-change-requests";

type QualificationChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "qualification" }>;
type QualificationFields = { name: string; institution: string; qualificationLevel: string; fieldOfStudy: string; awardedOn: string; notes: string };
const emptyQualification: QualificationFields = { name: "", institution: "", qualificationLevel: "", fieldOfStudy: "", awardedOn: "", notes: "" };

function snapshot(qualification: Qualification): QualificationFields {
  return { name: qualification.name, institution: qualification.institution, qualificationLevel: qualification.qualification_level ?? "", fieldOfStudy: qualification.field_of_study ?? "", awardedOn: qualification.awarded_on, notes: qualification.notes ?? "" };
}
function toRequestedValue(fields: QualificationFields) { return { ...fields, qualificationLevel: fields.qualificationLevel || null, fieldOfStudy: fields.fieldOfStudy || null, notes: fields.notes || null }; }
function qualificationDescription(change: QualificationChange) { return change.operation === "remove" ? `Remove: ${change.originalValue.name}` : `${change.operation === "add" ? "Add" : "Edit"}: ${change.requestedValue.name} — ${change.requestedValue.institution}`; }

export function ProfileChangeRequestForm() {
  const employee = useEmployeeForCurrentUser();
  const qualifications = usePersonnelEntries("qualification", employee.data?.id ?? "");
  const submit = useSubmitProfileChangeRequest();
  const [error, setError] = useState<string | null>(null);
  const [qualificationChanges, setQualificationChanges] = useState<QualificationChange[]>([]);
  const [operation, setOperation] = useState<"add" | "edit" | "remove">("add");
  const [qualificationId, setQualificationId] = useState("");
  const [qualification, setQualification] = useState<QualificationFields>(emptyQualification);
  if (employee.isLoading) return <p className="text-sm text-muted-foreground">Loading your official profile…</p>;
  if (!employee.data) return <ErrorState message="Your official employee record is not available." />;
  const employeeData = employee.data;
  const qualificationRows = (qualifications.data ?? []) as Qualification[];
  function changeQualificationField(field: keyof QualificationFields, value: string) { setQualification((current) => ({ ...current, [field]: value })); }
  function selectQualification(id: string) { setQualificationId(id); const selected = qualificationRows.find((item) => item.id === id); if (selected && operation !== "add") setQualification(snapshot(selected)); }
  function addQualificationChange() {
    const selected = qualificationRows.find((item) => item.id === qualificationId);
    if (operation !== "add" && !selected) { setError("Choose an existing qualification to edit or remove."); return; }
    if (operation !== "remove" && (!qualification.name.trim() || !qualification.institution.trim() || !qualification.awardedOn)) { setError("Qualification name, institution, and awarded date are required."); return; }
    const requestedValue = toRequestedValue(qualification);
    const change: QualificationChange = operation === "add" ? { kind: "qualification", operation: "add", originalValue: null, requestedValue } : operation === "edit" ? { kind: "qualification", operation: "edit", qualificationId: selected!.id, originalValue: toRequestedValue(snapshot(selected!)), requestedValue } : { kind: "qualification", operation: "remove", qualificationId: selected!.id, originalValue: toRequestedValue(snapshot(selected!)), requestedValue: null };
    setQualificationChanges((current) => change.operation === "add" ? [...current, change] : [...current.filter((item) => !("qualificationId" in item && item.qualificationId === change.qualificationId)), change]);
    setQualificationId(""); setQualification(emptyQualification); setError(null);
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); const form = new FormData(event.currentTarget);
    const contactChanges = ([
      ["personalEmail", "personal_email"], ["phone", "phone"], ["emergencyContactName", "emergency_contact_name"], ["emergencyContactPhone", "emergency_contact_phone"],
    ] as const).flatMap(([field, employeeField]) => { const requestedValue = String(form.get(field) ?? "").trim() || null; const originalValue = employeeData[employeeField] ?? null; return requestedValue === originalValue ? [] : [{ kind: "contact" as const, field, originalValue, requestedValue }]; });
    const changes = [...contactChanges, ...qualificationChanges];
    if (!changes.length) { setError("Change at least one contact field or add a qualification proposal."); return; }
    try { await submit.mutateAsync({ draft: { requestId: crypto.randomUUID(), note: String(form.get("note") ?? ""), changes }, files: Array.from((event.currentTarget.elements.namedItem("documents") as HTMLInputElement).files ?? []) }); event.currentTarget.reset(); setQualificationChanges([]); setQualification(emptyQualification); setQualificationId(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit your request."); }
  }
  return <form className="space-y-6" noValidate onSubmit={onSubmit}>
    <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Your official profile stays unchanged until an administrator approves this request.</p>
    <fieldset className="space-y-4"><legend className="text-base font-semibold">Contact details</legend><div className="grid gap-4 sm:grid-cols-2">{([
      ["personalEmail", "Personal email", employeeData.personal_email, "email"], ["phone", "Phone", employeeData.phone ?? "", "tel"], ["emergencyContactName", "Emergency contact name", employeeData.emergency_contact_name ?? "", "text"], ["emergencyContactPhone", "Emergency contact phone", employeeData.emergency_contact_phone ?? "", "tel"],
    ] as const).map(([name, label, value, type]) => <FormField htmlFor={name} key={name} label={label}><Input defaultValue={value} id={name} name={name} type={type} /></FormField>)}</div></fieldset>
    <fieldset className="space-y-4 rounded-xl border p-4"><legend className="px-1 text-base font-semibold">Qualification proposals</legend><p className="text-sm text-muted-foreground">Add, edit, or remove any number of qualifications. Each proposal is reviewed with the rest of this request.</p>
      <div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="qualification-operation" label="Requested action"><select className="min-h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm" id="qualification-operation" onChange={(event) => { setOperation(event.target.value as "add" | "edit" | "remove"); if (event.target.value === "add") { setQualificationId(""); setQualification(emptyQualification); } }} value={operation}><option value="add">Add qualification</option><option value="edit">Edit qualification</option><option value="remove">Remove qualification</option></select></FormField>{operation !== "add" ? <FormField htmlFor="qualification-id" label="Existing qualification"><select className="min-h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm" id="qualification-id" onChange={(event) => selectQualification(event.target.value)} value={qualificationId}><option value="">Choose a qualification</option>{qualificationRows.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.institution}</option>)}</select></FormField> : null}</div>
      {operation !== "remove" ? <div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="qualification-name" label="Qualification name"><Input id="qualification-name" onChange={(event) => changeQualificationField("name", event.target.value)} value={qualification.name} /></FormField><FormField htmlFor="qualification-institution" label="Institution"><Input id="qualification-institution" onChange={(event) => changeQualificationField("institution", event.target.value)} value={qualification.institution} /></FormField><FormField htmlFor="qualification-level" label="Qualification level"><Input id="qualification-level" onChange={(event) => changeQualificationField("qualificationLevel", event.target.value)} value={qualification.qualificationLevel} /></FormField><FormField htmlFor="field-of-study" label="Field of study"><Input id="field-of-study" onChange={(event) => changeQualificationField("fieldOfStudy", event.target.value)} value={qualification.fieldOfStudy} /></FormField><FormField htmlFor="awarded-on" label="Awarded on"><Input id="awarded-on" onChange={(event) => changeQualificationField("awardedOn", event.target.value)} type="date" value={qualification.awardedOn} /></FormField><FormField htmlFor="qualification-notes" label="Notes"><textarea className="min-h-24 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm" id="qualification-notes" onChange={(event) => changeQualificationField("notes", event.target.value)} value={qualification.notes} /></FormField></div> : <p className="rounded-lg bg-muted px-3 py-2 text-sm">The selected qualification will be removed only if the request is approved.</p>}
      <Button onClick={addQualificationChange} type="button" variant="outline">Add proposal to request</Button>
      {qualificationChanges.length ? <ul aria-label="Qualification proposals" className="space-y-2">{qualificationChanges.map((change, index) => <li className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm" key={`${change.operation}-${"qualificationId" in change ? change.qualificationId : index}`}><span>{qualificationDescription(change)}</span><Button aria-label={`Remove qualification proposal ${index + 1}`} onClick={() => setQualificationChanges((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button" variant="ghost">Remove</Button></li>)}</ul> : null}
    </fieldset>
    <FormField htmlFor="documents" label="Supporting documents"><Input accept="application/pdf,image/png,image/jpeg,image/webp" id="documents" multiple name="documents" type="file" /><p className="mt-1 text-xs text-muted-foreground">Optional. Up to 10 PDF, PNG, JPEG, or WEBP files, 10 MiB each.</p></FormField>
    <FormField htmlFor="request-note" label="Note for the reviewer"><textarea className="min-h-24 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm" id="request-note" maxLength={2000} name="note" /></FormField>
    {error ? <ErrorState message={error} /> : null}<Button className="min-h-11" disabled={submit.isPending} type="submit">{submit.isPending ? "Submitting…" : "Submit request"}</Button>
  </form>;
}
