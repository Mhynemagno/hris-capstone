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
import { PNP_CERTIFICATIONS, PNP_ISSUERS, PNP_QUALIFICATIONS, PNP_TRAININGS, PNP_TRAINING_PROVIDERS, withSavedValue } from "@/lib/pnp-catalogue";
import type { Certification, Qualification, TrainingRecord } from "@/lib/types/database";
import {
  profileChangeContactChangeSchema,
  profileChangeQualificationSnapshotSchema,
  type ProfileChangeDraftInput,
} from "@/schemas/profile-change-requests";

type QualificationChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "qualification" }>;
type CertificationChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "certification" }>;
type TrainingChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "training" }>;
type QualificationFields = { name: string; awardedOn: string; notes: string };
const emptyQualification: QualificationFields = { name: "", awardedOn: "", notes: "" };
type CertificationFields = { name: string; issuer: string; credentialId: string; issuedOn: string; expiresOn: string; notes: string };
const emptyCertification: CertificationFields = { name: "", issuer: "", credentialId: "", issuedOn: "", expiresOn: "", notes: "" };
type TrainingFields = { courseName: string; provider: string; completedOn: string; expiresOn: string; hours: string; notes: string };
const emptyTraining: TrainingFields = { courseName: "", provider: "", completedOn: "", expiresOn: "", hours: "", notes: "" };

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
function certificationSnapshot(certification: Certification): CertificationFields {
  return { name: certification.name, issuer: certification.issuer ?? "", credentialId: certification.credential_id ?? "", issuedOn: certification.issued_on, expiresOn: certification.expires_on ?? "", notes: certification.notes ?? "" };
}
function requestedCertificationValue(fields: CertificationFields) {
  return { name: fields.name, issuer: fields.issuer || null, credentialId: fields.credentialId || null, issuedOn: fields.issuedOn, expiresOn: fields.expiresOn || null, notes: fields.notes || null };
}
function certificationDescription(change: CertificationChange) {
  return change.operation === "remove" ? `Remove: ${change.originalValue.name}` : `${change.operation === "add" ? "Add" : "Edit"}: ${change.requestedValue.name}`;
}
function trainingSnapshot(training: TrainingRecord): TrainingFields {
  return { courseName: training.course_name, provider: training.provider, completedOn: training.completed_on, expiresOn: training.expires_on ?? "", hours: training.hours?.toString() ?? "", notes: training.notes ?? "" };
}
function requestedTrainingValue(fields: TrainingFields) {
  return { courseName: fields.courseName, provider: fields.provider, completedOn: fields.completedOn, expiresOn: fields.expiresOn || null, hours: fields.hours === "" ? null : Number(fields.hours), notes: fields.notes || null };
}
function trainingDescription(change: TrainingChange) {
  return change.operation === "remove" ? `Remove: ${change.originalValue.courseName}` : `${change.operation === "add" ? "Add" : "Edit"}: ${change.requestedValue.courseName}`;
}

type QualificationErrors = Partial<Record<keyof QualificationFields | "qualificationId", string>>;
type CertificationErrors = Partial<Record<keyof CertificationFields | "certificationId", string>>;
type TrainingErrors = Partial<Record<keyof TrainingFields | "trainingRecordId", string>>;
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
function certificationFieldErrors(fields: CertificationFields): CertificationErrors {
  const errors: CertificationErrors = {};
  if (!fields.name) errors.name = "Select a certification.";
  if (!fields.issuedOn) errors.issuedOn = "Enter the issue date.";
  if (fields.expiresOn && fields.issuedOn && fields.expiresOn < fields.issuedOn) errors.expiresOn = "Expiry date cannot be before the issue date.";
  return errors;
}
function trainingFieldErrors(fields: TrainingFields): TrainingErrors {
  const errors: TrainingErrors = {};
  if (!fields.courseName) errors.courseName = "Select a training course.";
  if (!fields.provider) errors.provider = "Select the training provider.";
  if (!fields.completedOn) errors.completedOn = "Enter the completion date.";
  if (fields.expiresOn && fields.completedOn && fields.expiresOn < fields.completedOn) errors.expiresOn = "Expiry date cannot be before the completion date.";
  if (fields.hours && (!Number.isFinite(Number(fields.hours)) || Number(fields.hours) < 0 || Number(fields.hours) > 9999.99)) errors.hours = "Enter hours between 0 and 9999.99.";
  return errors;
}

export function ProfileChangeRequestForm() {
  const employee = useEmployeeForCurrentUser();
  const qualifications = usePersonnelEntries("qualification", employee.data?.id ?? "");
  const certifications = usePersonnelEntries("certification", employee.data?.id ?? "");
  const trainings = usePersonnelEntries("training", employee.data?.id ?? "");
  const submit = useSubmitProfileChangeRequest();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contactErrors, setContactErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [qualificationErrors, setQualificationErrors] = useState<QualificationErrors>({});
  const [certificationErrors, setCertificationErrors] = useState<CertificationErrors>({});
  const [trainingErrors, setTrainingErrors] = useState<TrainingErrors>({});
  const [qualificationChanges, setQualificationChanges] = useState<QualificationChange[]>([]);
  const [certificationChanges, setCertificationChanges] = useState<CertificationChange[]>([]);
  const [trainingChanges, setTrainingChanges] = useState<TrainingChange[]>([]);
  const [operation, setOperation] = useState<"add" | "edit" | "remove">("add");
  const [qualificationId, setQualificationId] = useState("");
  const [qualification, setQualification] = useState<QualificationFields>(emptyQualification);
  const [certificationOperation, setCertificationOperation] = useState<"add" | "edit" | "remove">("add");
  const [certificationId, setCertificationId] = useState("");
  const [certification, setCertification] = useState<CertificationFields>(emptyCertification);
  const [trainingOperation, setTrainingOperation] = useState<"add" | "edit" | "remove">("add");
  const [trainingRecordId, setTrainingRecordId] = useState("");
  const [training, setTraining] = useState<TrainingFields>(emptyTraining);
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
  const certificationRows = (certifications.data ?? []) as Certification[];
  const trainingRows = (trainings.data ?? []) as TrainingRecord[];

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
  function changeCertificationField(field: keyof CertificationFields, value: string) {
    setCertification((current) => ({ ...current, [field]: value }));
    setCertificationErrors((current) => ({ ...current, [field]: undefined }));
  }
  function selectCertification(id: string) {
    setCertificationId(id);
    setCertificationErrors((current) => ({ ...current, certificationId: undefined }));
    const selected = certificationRows.find((item) => item.id === id);
    if (selected && certificationOperation !== "add") setCertification(certificationSnapshot(selected));
  }
  function addCertificationChange() {
    setSuccess(null);
    const selected = certificationRows.find((item) => item.id === certificationId);
    const errors: CertificationErrors = {};
    if (certificationOperation !== "add" && !selected) errors.certificationId = "Choose an existing certification to edit or remove.";
    if (certificationOperation !== "remove") Object.assign(errors, certificationFieldErrors(certification));
    setCertificationErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const requestedValue = requestedCertificationValue(certification);
    const originalValue = selected ? requestedCertificationValue(certificationSnapshot(selected)) : null;
    const change: CertificationChange = certificationOperation === "add"
      ? { kind: "certification", operation: "add", originalValue: null, requestedValue }
      : certificationOperation === "edit"
        ? { kind: "certification", operation: "edit", certificationId: selected!.id, originalValue: originalValue!, requestedValue }
        : { kind: "certification", operation: "remove", certificationId: selected!.id, originalValue: originalValue!, requestedValue: null };
    setCertificationChanges((current) => change.operation === "add" ? [...current, change] : [...current.filter((item) => !("certificationId" in item && item.certificationId === change.certificationId)), change]);
    setCertificationId("");
    setCertification(emptyCertification);
    setError(null);
  }
  function changeTrainingField(field: keyof TrainingFields, value: string) {
    setTraining((current) => ({ ...current, [field]: value }));
    setTrainingErrors((current) => ({ ...current, [field]: undefined }));
  }
  function selectTraining(id: string) {
    setTrainingRecordId(id);
    setTrainingErrors((current) => ({ ...current, trainingRecordId: undefined }));
    const selected = trainingRows.find((item) => item.id === id);
    if (selected && trainingOperation !== "add") setTraining(trainingSnapshot(selected));
  }
  function addTrainingChange() {
    setSuccess(null);
    const selected = trainingRows.find((item) => item.id === trainingRecordId);
    const errors: TrainingErrors = {};
    if (trainingOperation !== "add" && !selected) errors.trainingRecordId = "Choose an existing training record to edit or remove.";
    if (trainingOperation !== "remove") Object.assign(errors, trainingFieldErrors(training));
    setTrainingErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const requestedValue = requestedTrainingValue(training);
    const originalValue = selected ? requestedTrainingValue(trainingSnapshot(selected)) : null;
    const change: TrainingChange = trainingOperation === "add"
      ? { kind: "training", operation: "add", originalValue: null, requestedValue }
      : trainingOperation === "edit"
        ? { kind: "training", operation: "edit", trainingRecordId: selected!.id, originalValue: originalValue!, requestedValue }
        : { kind: "training", operation: "remove", trainingRecordId: selected!.id, originalValue: originalValue!, requestedValue: null };
    setTrainingChanges((current) => change.operation === "add" ? [...current, change] : [...current.filter((item) => !("trainingRecordId" in item && item.trainingRecordId === change.trainingRecordId)), change]);
    setTrainingRecordId("");
    setTraining(emptyTraining);
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
    const changes = [...contactChanges, ...qualificationChanges, ...certificationChanges, ...trainingChanges];
    if (!changes.length) {
      setError("Change at least one contact field or add an eligibility, certification, or training change.");
      return;
    }
    const files = Array.from((formElement.elements.namedItem("documents") as HTMLInputElement | null)?.files ?? []);
    if (!files.length) {
      setError("Attach at least one supporting document.");
      return;
    }
    try {
      await submit.mutateAsync({
        draft: { requestId: crypto.randomUUID(), note: String(form.get("note") ?? ""), changes },
        files,
      });
      formElement.reset();
      setQualificationChanges([]);
      setCertificationChanges([]);
      setTrainingChanges([]);
      setQualification(emptyQualification);
      setQualificationId("");
      setCertification(emptyCertification);
      setCertificationId("");
      setTraining(emptyTraining);
      setTrainingRecordId("");
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
          <FormField htmlFor="qualification-operation" label="Eligibility action">
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
              <FormField error={qualificationErrors.notes} htmlFor="qualification-notes" label="Eligibility remarks">
                <Textarea id="qualification-notes" maxLength={2000} onChange={(event) => changeQualificationField("notes", event.target.value)} value={qualification.notes} />
              </FormField>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">The selected eligibility will be removed only if the request is approved.</p>
        )}
        <Button onClick={addQualificationChange} type="button" variant="outline">
          Add eligibility change
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
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-base font-semibold">Certification proposals</legend>
        <p className="text-sm text-muted-foreground">Request a certification or course record to be added, corrected, or removed. HR reviews it before changing your official file.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="certification-operation" label="Certification action">
            <select className={nativeSelectClassName} id="certification-operation" onChange={(event) => { setCertificationOperation(event.target.value as "add" | "edit" | "remove"); setCertificationErrors({}); if (event.target.value === "add") { setCertificationId(""); setCertification(emptyCertification); } }} value={certificationOperation}>
              <option value="add">Add certification</option><option value="edit">Edit certification</option><option value="remove">Remove certification</option>
            </select>
          </FormField>
          {certificationOperation !== "add" ? <FormField description={certificationRows.length ? undefined : "You have no certifications on record yet."} error={certificationErrors.certificationId} htmlFor="certification-id" label="Existing certification" required>
            <select className={nativeSelectClassName} id="certification-id" onChange={(event) => selectCertification(event.target.value)} value={certificationId}><option value="">Choose a certification</option>{certificationRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </FormField> : null}
        </div>
        {certificationOperation !== "remove" ? <div className="grid gap-4 sm:grid-cols-2">
          <FormField error={certificationErrors.name} htmlFor="certification-name" label="Certification / course" required><select className={nativeSelectClassName} id="certification-name" onChange={(event) => changeCertificationField("name", event.target.value)} value={certification.name}><option value="">Select a certification / course</option>{withSavedValue(PNP_CERTIFICATIONS, certification.name).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></FormField>
          <FormField error={certificationErrors.issuer} htmlFor="certification-issuer" label="Issuer"><select className={nativeSelectClassName} id="certification-issuer" onChange={(event) => changeCertificationField("issuer", event.target.value)} value={certification.issuer}><option value="">Not specified</option>{withSavedValue(PNP_ISSUERS, certification.issuer).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></FormField>
          <FormField error={certificationErrors.issuedOn} htmlFor="certification-issued-on" label="Issue date" required><Input id="certification-issued-on" onChange={(event) => changeCertificationField("issuedOn", event.target.value)} type="date" value={certification.issuedOn} /></FormField>
          <FormField error={certificationErrors.expiresOn} htmlFor="certification-expires-on" label="Expiry date"><Input id="certification-expires-on" onChange={(event) => changeCertificationField("expiresOn", event.target.value)} type="date" value={certification.expiresOn} /></FormField>
          <FormField error={certificationErrors.credentialId} htmlFor="certification-credential-id" label="Credential ID"><Input id="certification-credential-id" maxLength={160} onChange={(event) => changeCertificationField("credentialId", event.target.value)} value={certification.credentialId} /></FormField>
          <FormField error={certificationErrors.notes} htmlFor="certification-notes" label="Certification remarks"><Textarea id="certification-notes" maxLength={2000} onChange={(event) => changeCertificationField("notes", event.target.value)} value={certification.notes} /></FormField>
        </div> : <p className="rounded-lg bg-muted px-3 py-2 text-sm">The selected certification will be removed only if the request is approved.</p>}
        <Button onClick={addCertificationChange} type="button" variant="outline">Add certification change</Button>
        {certificationChanges.length ? <ul aria-label="Certification proposals" className="space-y-2">{certificationChanges.map((change, index) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm" key={`${change.operation}-${"certificationId" in change ? change.certificationId : index}`}><span>{certificationDescription(change)}</span><Button aria-label={`Remove certification proposal ${index + 1}`} onClick={() => setCertificationChanges((current) => current.filter((_, currentIndex) => currentIndex !== index))} size="sm" type="button" variant="outline">Remove</Button></li>)}</ul> : null}
      </fieldset>
      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-base font-semibold">Training proposals</legend>
        <p className="text-sm text-muted-foreground">Request training records to be added, corrected, or removed. HR reviews every proposed change.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="training-operation" label="Training action"><select className={nativeSelectClassName} id="training-operation" onChange={(event) => { setTrainingOperation(event.target.value as "add" | "edit" | "remove"); setTrainingErrors({}); if (event.target.value === "add") { setTrainingRecordId(""); setTraining(emptyTraining); } }} value={trainingOperation}><option value="add">Add training</option><option value="edit">Edit training</option><option value="remove">Remove training</option></select></FormField>
          {trainingOperation !== "add" ? <FormField description={trainingRows.length ? undefined : "You have no training on record yet."} error={trainingErrors.trainingRecordId} htmlFor="training-record-id" label="Existing training" required><select className={nativeSelectClassName} id="training-record-id" onChange={(event) => selectTraining(event.target.value)} value={trainingRecordId}><option value="">Choose a training record</option>{trainingRows.map((item) => <option key={item.id} value={item.id}>{item.course_name}</option>)}</select></FormField> : null}
        </div>
        {trainingOperation !== "remove" ? <div className="grid gap-4 sm:grid-cols-2">
          <FormField error={trainingErrors.courseName} htmlFor="training-course-name" label="Training course" required><select className={nativeSelectClassName} id="training-course-name" onChange={(event) => changeTrainingField("courseName", event.target.value)} value={training.courseName}><option value="">Select a training course</option>{withSavedValue(PNP_TRAININGS, training.courseName).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></FormField>
          <FormField error={trainingErrors.provider} htmlFor="training-provider" label="Training provider" required><select className={nativeSelectClassName} id="training-provider" onChange={(event) => changeTrainingField("provider", event.target.value)} value={training.provider}><option value="">Select the provider</option>{withSavedValue(PNP_TRAINING_PROVIDERS, training.provider).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></FormField>
          <FormField error={trainingErrors.completedOn} htmlFor="training-completed-on" label="Completion date" required><Input id="training-completed-on" onChange={(event) => changeTrainingField("completedOn", event.target.value)} type="date" value={training.completedOn} /></FormField>
          <FormField error={trainingErrors.expiresOn} htmlFor="training-expires-on" label="Expiry date"><Input id="training-expires-on" onChange={(event) => changeTrainingField("expiresOn", event.target.value)} type="date" value={training.expiresOn} /></FormField>
          <FormField error={trainingErrors.hours} htmlFor="training-hours" label="Hours"><Input id="training-hours" max="9999.99" min="0" onChange={(event) => changeTrainingField("hours", event.target.value)} step="0.01" type="number" value={training.hours} /></FormField>
          <FormField error={trainingErrors.notes} htmlFor="training-notes" label="Training remarks"><Textarea id="training-notes" maxLength={2000} onChange={(event) => changeTrainingField("notes", event.target.value)} value={training.notes} /></FormField>
        </div> : <p className="rounded-lg bg-muted px-3 py-2 text-sm">The selected training record will be removed only if the request is approved.</p>}
        <Button onClick={addTrainingChange} type="button" variant="outline">Add training change</Button>
        {trainingChanges.length ? <ul aria-label="Training proposals" className="space-y-2">{trainingChanges.map((change, index) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm" key={`${change.operation}-${"trainingRecordId" in change ? change.trainingRecordId : index}`}><span>{trainingDescription(change)}</span><Button aria-label={`Remove training proposal ${index + 1}`} onClick={() => setTrainingChanges((current) => current.filter((_, currentIndex) => currentIndex !== index))} size="sm" type="button" variant="outline">Remove</Button></li>)}</ul> : null}
      </fieldset>
      <FormField description="Required. Up to 10 PDF, PNG, JPEG, or WEBP files, 10 MiB each." htmlFor="documents" label="Supporting documents" required>
        <Input accept="application/pdf,image/png,image/jpeg,image/webp" id="documents" multiple name="documents" required type="file" />
      </FormField>
      <FormField htmlFor="request-note" label="Remarks">
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
