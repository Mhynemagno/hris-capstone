"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useEmployeeForCurrentUser, usePersonnelEntries } from "@/hooks/use-personnel-records";
import { useSubmitProfileChangeRequest } from "@/hooks/use-profile-change-requests";
import { PNP_QUALIFICATIONS, withSavedValue } from "@/lib/pnp-catalogue";
import type { Qualification } from "@/lib/types/database";
import {
  profileChangeContactChangeSchema,
  profileChangeQualificationSnapshotSchema,
  type ProfileChangeDraftInput,
} from "@/schemas/profile-change-requests";

type QualificationChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "qualification" }>;
type QualificationFields = { name: string; awardedOn: string; notes: string };
const emptyQualification: QualificationFields = { name: "", awardedOn: "", notes: "" };

function snapshot(qualification: Qualification): QualificationFields {
  return {
    name: qualification.name,
    awardedOn: qualification.awarded_on,
    notes: qualification.notes ?? "",
  };
}
/** Eligibility is recorded by name and date only; institution, level, and field of study are sent as null. */
function toRequestedValue(fields: QualificationFields) {
  return { ...fields, institution: null, qualificationLevel: null, fieldOfStudy: null, notes: fields.notes || null };
}

/** The saved entry as it is compared on approval, keeping any older institution, level, or field of study. */
function originalValue(qualification: Qualification) {
  return {
    name: qualification.name,
    institution: qualification.institution ?? null,
    qualificationLevel: qualification.qualification_level ?? null,
    fieldOfStudy: qualification.field_of_study ?? null,
    awardedOn: qualification.awarded_on,
    notes: qualification.notes ?? null,
  };
}
function qualificationDescription(change: QualificationChange) {
  return change.operation === "remove"
    ? `Remove: ${change.originalValue.name}`
    : `${change.operation === "add" ? "Add" : "Edit"}: ${change.requestedValue.name}`;
}

type QualificationErrors = Partial<Record<keyof QualificationFields | "qualificationId", string>>;
type ContactField = "personalEmail" | "phone" | "emergencyContactName" | "emergencyContactPhone";

function qualificationFieldErrors(fields: QualificationFields): QualificationErrors {
  const parsed = profileChangeQualificationSnapshotSchema.safeParse(toRequestedValue(fields));
  if (parsed.success) return {};
  const errors: QualificationErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof QualificationFields;
    if (!key || errors[key]) continue;
    errors[key] =
      key === "name"
        ? "Select an eligibility."
        : key === "awardedOn"
          ? "Enter the date the eligibility was obtained."
          : issue.message;
  }
  return errors;
}

export function ProfileChangeRequestForm() {
  const employee = useEmployeeForCurrentUser();
  const qualifications = usePersonnelEntries("qualification", employee.data?.id ?? "");
  const submit = useSubmitProfileChangeRequest();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contactErrors, setContactErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [qualificationErrors, setQualificationErrors] = useState<QualificationErrors>({});
  const [qualificationChanges, setQualificationChanges] = useState<QualificationChange[]>([]);
  const [operation, setOperation] = useState<"add" | "edit" | "remove">("add");
  const [qualificationId, setQualificationId] = useState("");
  const [qualification, setQualification] = useState<QualificationFields>(emptyQualification);
  if (employee.isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading your official profile…
      </p>
    );
  }
  if (!employee.data) return <ErrorState message="Your official employee record is not available." />;
  const employeeData = employee.data;
  const qualificationRows = (qualifications.data ?? []) as Qualification[];

  function changeQualificationField(field: keyof QualificationFields, value: string) {
    setQualification((current) => ({ ...current, [field]: value }));
    setQualificationErrors((current) => ({ ...current, [field]: undefined }));
  }
  function selectQualification(id: string) {
    setQualificationId(id);
    setQualificationErrors((current) => ({ ...current, qualificationId: undefined }));
    const selected = qualificationRows.find((item) => item.id === id);
    if (selected && operation !== "add") setQualification(snapshot(selected));
  }
  function addQualificationChange() {
    setSuccess(null);
    const selected = qualificationRows.find((item) => item.id === qualificationId);
    const errors: QualificationErrors = {};
    if (operation !== "add" && !selected) errors.qualificationId = "Choose an existing eligibility to edit or remove.";
    if (operation !== "remove") Object.assign(errors, qualificationFieldErrors(qualification));
    setQualificationErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const requestedValue = toRequestedValue(qualification);
    const change: QualificationChange =
      operation === "add"
        ? { kind: "qualification", operation: "add", originalValue: null, requestedValue }
        : operation === "edit"
          ? { kind: "qualification", operation: "edit", qualificationId: selected!.id, originalValue: originalValue(selected!), requestedValue }
          : { kind: "qualification", operation: "remove", qualificationId: selected!.id, originalValue: originalValue(selected!), requestedValue: null };
    setQualificationChanges((current) =>
      change.operation === "add"
        ? [...current, change]
        : [...current.filter((item) => !("qualificationId" in item && item.qualificationId === change.qualificationId)), change],
    );
    setQualificationId("");
    setQualification(emptyQualification);
    setError(null);
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const contactChanges = (
      [
        ["personalEmail", "personal_email"],
        ["phone", "phone"],
        ["emergencyContactName", "emergency_contact_name"],
        ["emergencyContactPhone", "emergency_contact_phone"],
      ] as const
    ).flatMap(([field, employeeField]) => {
      const requestedValue = String(form.get(field) ?? "").trim() || null;
      const originalValue = employeeData[employeeField] ?? null;
      return requestedValue === originalValue ? [] : [{ kind: "contact" as const, field, originalValue, requestedValue }];
    });
    const nextContactErrors: Partial<Record<ContactField, string>> = {};
    for (const change of contactChanges) {
      const parsed = profileChangeContactChangeSchema.safeParse(change);
      if (!parsed.success) nextContactErrors[change.field] = parsed.error.issues[0]?.message ?? "Check this value.";
    }
    setContactErrors(nextContactErrors);
    if (Object.keys(nextContactErrors).length) return;
    const changes = [...contactChanges, ...qualificationChanges];
    if (!changes.length) {
      setError("Change at least one contact field or add an eligibility proposal.");
      return;
    }
    try {
      await submit.mutateAsync({
        draft: { requestId: crypto.randomUUID(), note: String(form.get("note") ?? ""), changes },
        files: Array.from((formElement.elements.namedItem("documents") as HTMLInputElement | null)?.files ?? []),
      });
      formElement.reset();
      setQualificationChanges([]);
      setQualification(emptyQualification);
      setQualificationId("");
      setSuccess("Request submitted. An administrator will review it; your official profile stays unchanged until then.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit your request.");
    }
  }
  return (
    <form className="max-w-3xl space-y-6" noValidate onSubmit={onSubmit}>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Your official profile stays unchanged until an administrator approves this request.
      </p>
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Contact details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["personalEmail", "Personal email", employeeData.personal_email, "email", "email"],
              ["phone", "Phone number", employeeData.phone ?? "", "tel", "tel"],
              ["emergencyContactName", "Emergency contact name", employeeData.emergency_contact_name ?? "", "text", "off"],
              ["emergencyContactPhone", "Emergency contact phone number", employeeData.emergency_contact_phone ?? "", "tel", "off"],
            ] as const
          ).map(([name, label, value, type, autoComplete]) => (
            <FormField error={contactErrors[name]} htmlFor={name} key={name} label={label}>
              <Input autoComplete={autoComplete} defaultValue={value} id={name} name={name} type={type} />
            </FormField>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-base font-semibold">Eligibility proposals</legend>
        <p className="text-sm text-muted-foreground">
          Add, edit, or remove any number of eligibility entries. Each proposal is reviewed with the rest of this request.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="qualification-operation" label="Requested action">
            <select
              className={nativeSelectClassName}
              id="qualification-operation"
              onChange={(event) => {
                setOperation(event.target.value as "add" | "edit" | "remove");
                setQualificationErrors({});
                if (event.target.value === "add") {
                  setQualificationId("");
                  setQualification(emptyQualification);
                }
              }}
              value={operation}
            >
              <option value="add">Add eligibility</option>
              <option value="edit">Edit eligibility</option>
              <option value="remove">Remove eligibility</option>
            </select>
          </FormField>
          {operation !== "add" ? (
            <FormField
              description={qualificationRows.length ? undefined : "You have no eligibility on record yet."}
              error={qualificationErrors.qualificationId}
              htmlFor="qualification-id"
              label="Existing eligibility"
              required
            >
              <select className={nativeSelectClassName} id="qualification-id" onChange={(event) => selectQualification(event.target.value)} value={qualificationId}>
                <option value="">Choose an eligibility</option>
                {qualificationRows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
        </div>
        {operation !== "remove" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={qualificationErrors.name} htmlFor="qualification-name" label="Eligibility" required>
              <select className={nativeSelectClassName} id="qualification-name" onChange={(event) => changeQualificationField("name", event.target.value)} value={qualification.name}>
                <option value="">Select an eligibility</option>
                {withSavedValue(PNP_QUALIFICATIONS, qualification.name).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
              </select>
            </FormField>
            <FormField error={qualificationErrors.awardedOn} htmlFor="awarded-on" label="Date obtained" required>
              <Input id="awarded-on" onChange={(event) => changeQualificationField("awardedOn", event.target.value)} type="date" value={qualification.awardedOn} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField error={qualificationErrors.notes} htmlFor="qualification-notes" label="Remarks">
                <Textarea id="qualification-notes" maxLength={2000} onChange={(event) => changeQualificationField("notes", event.target.value)} value={qualification.notes} />
              </FormField>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">The selected eligibility will be removed only if the request is approved.</p>
        )}
        <Button onClick={addQualificationChange} type="button" variant="outline">
          Add proposal to request
        </Button>
        {qualificationChanges.length ? (
          <ul aria-label="Eligibility proposals" className="space-y-2">
            {qualificationChanges.map((change, index) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm"
                key={`${change.operation}-${"qualificationId" in change ? change.qualificationId : index}`}
              >
                <span>{qualificationDescription(change)}</span>
                <Button
                  aria-label={`Remove eligibility proposal ${index + 1}`}
                  onClick={() => setQualificationChanges((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>
      <FormField description="Optional. Up to 10 PDF, PNG, JPEG, or WEBP files, 10 MiB each." htmlFor="documents" label="Supporting documents">
        <Input accept="application/pdf,image/png,image/jpeg,image/webp" id="documents" multiple name="documents" type="file" />
      </FormField>
      <FormField htmlFor="request-note" label="Note for the reviewer">
        <Textarea id="request-note" maxLength={2000} name="note" />
      </FormField>
      {error ? <ErrorState message={error} /> : null}
      {success ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="status">
          {success}
        </p>
      ) : null}
      <Button className="min-h-11" disabled={submit.isPending} type="submit">
        {submit.isPending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
