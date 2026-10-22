"use client";

import { useState, type FormEvent } from "react";

import { BadgeNumberInput } from "@/components/ui/badge-number-input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { GovernmentIdInput } from "@/components/ui/government-id-input";
import { Input } from "@/components/ui/input";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { NupIdInput } from "@/components/ui/nup-id-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { useEmployeeForCurrentUser, usePersonnelEntries } from "@/hooks/use-personnel-records";
import { useSubmitProfileChangeRequest } from "@/hooks/use-profile-change-requests";
import { PNP_CERTIFICATIONS, PNP_ISSUERS, PNP_QUALIFICATIONS, PNP_TRAININGS, PNP_TRAINING_PROVIDERS, withSavedValue } from "@/lib/pnp-catalogue";
import type { GovernmentIdKind } from "@/lib/government-ids";
import { formatRating } from "@/lib/personnel/eligibility";
import type { Certification, Employee, Qualification, TrainingRecord } from "@/lib/types/database";
import { BADGE_NUMBER_PATTERN } from "@/schemas/common";
import { EMERGENCY_CONTACT_RELATIONSHIPS, PHILIPPINE_MOBILE_PATTERN, RELIGIONS, toPhilippineMobile } from "@/schemas/personnel-records";
import {
  PERSONAL_FIELD_LABELS,
  profileChangeContactChangeSchema,
  profileChangeQualificationSnapshotSchema,
  type PersonalField,
  type ProfileChangeDraftInput,
} from "@/schemas/profile-change-requests";

type QualificationChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "qualification" }>;
type CertificationChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "certification" }>;
type TrainingChange = Extract<ProfileChangeDraftInput["changes"][number], { kind: "training" }>;
type QualificationFields = { name: string; awardedOn: string; rating: string; notes: string };
const emptyQualification: QualificationFields = { name: "", awardedOn: "", rating: "", notes: "" };
type CertificationFields = { name: string; issuer: string; credentialId: string; issuedOn: string; expiresOn: string; notes: string };
const emptyCertification: CertificationFields = { name: "", issuer: "", credentialId: "", issuedOn: "", expiresOn: "", notes: "" };
type TrainingFields = { courseName: string; provider: string; completedOn: string; expiresOn: string; hours: string; notes: string };
const emptyTraining: TrainingFields = { courseName: "", provider: "", completedOn: "", expiresOn: "", hours: "", notes: "" };

function snapshot(qualification: Qualification): QualificationFields {
  return {
    name: qualification.name,
    awardedOn: qualification.awarded_on,
    rating: qualification.rating === null || qualification.rating === undefined ? "" : String(qualification.rating),
    notes: qualification.notes ?? "",
  };
}
/** Eligibility is recorded by name and date only; institution, level, and field of study are sent as null. */
function toRequestedValue(fields: QualificationFields) {
  return { ...fields, institution: null, qualificationLevel: null, fieldOfStudy: null, notes: fields.notes || null, rating: fields.rating.trim() === "" ? null : Number(fields.rating) };
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
    rating: qualification.rating ?? null,
  };
}
function qualificationDescription(change: QualificationChange) {
  return change.operation === "remove"
    ? `Remove: ${change.originalValue.name}`
    : `${change.operation === "add" ? "Add" : "Edit"}: ${change.requestedValue.name}${change.requestedValue.rating === null || change.requestedValue.rating === undefined ? "" : ` — ${formatRating(change.requestedValue.rating)}`}`;
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

type PersonalInputKind = "text" | "date" | "email" | "phone" | "badge" | "government" | "gender" | "civilStatus" | "religion" | "relationship";
type PersonalFieldConfig = { field: PersonalField; column: keyof Employee; input: PersonalInputKind; government?: GovernmentIdKind | "sss" };

/** Every HR-entered personal field, grouped as on the HR employee form. */
const PERSONAL_SECTIONS: { title: string; fields: PersonalFieldConfig[] }[] = [
  {
    title: "Personal details",
    fields: [
      { field: "employeeNumber", column: "employee_number", input: "badge" },
      { field: "firstName", column: "first_name", input: "text" },
      { field: "middleName", column: "middle_name", input: "text" },
      { field: "lastName", column: "last_name", input: "text" },
      { field: "qualifier", column: "qualifier", input: "text" },
      { field: "placeOfBirth", column: "place_of_birth", input: "text" },
      { field: "dateOfBirth", column: "date_of_birth", input: "date" },
      { field: "gender", column: "gender", input: "gender" },
      { field: "civilStatus", column: "civil_status", input: "civilStatus" },
      { field: "religion", column: "religion", input: "religion" },
    ],
  },
  {
    title: "Contact details",
    fields: [
      { field: "personalEmail", column: "personal_email", input: "email" },
      { field: "phone", column: "phone", input: "phone" },
      { field: "address", column: "address", input: "text" },
    ],
  },
  {
    title: "Emergency contact",
    fields: [
      { field: "emergencyContactName", column: "emergency_contact_name", input: "text" },
      { field: "emergencyContactPhone", column: "emergency_contact_phone", input: "phone" },
      { field: "emergencyContactRelationship", column: "emergency_contact_relationship", input: "relationship" },
    ],
  },
  {
    title: "Government identification",
    fields: [
      { field: "sssNumber", column: "sss_number", input: "government", government: "sss" },
      { field: "philhealthNumber", column: "philhealth_number", input: "government", government: "philhealth" },
      { field: "gsisNumber", column: "gsis_number", input: "government", government: "gsis" },
      { field: "pagibigNumber", column: "pagibig_number", input: "government", government: "pagibig" },
    ],
  },
  { title: "Employment", fields: [{ field: "employmentStartedOn", column: "employment_started_on", input: "date" }] },
];
const PERSONAL_FIELD_CONFIGS = PERSONAL_SECTIONS.flatMap((section) => section.fields);
const CIVIL_STATUS_CHOICES = ["single", "married", "widowed", "separated", "divorced"] as const;
const capitalize = (value: string) => value[0]!.toUpperCase() + value.slice(1);

/** The value as it is compared and sent: separators dropped from IDs, phones in +639 form, blank as null. */
function normalizePersonalValue(config: PersonalFieldConfig, raw: string, isNup: boolean): string | null {
  const trimmed = raw.trim();
  const value =
    config.input === "government" ? trimmed.replace(/[\s-]/g, "")
      : config.input === "phone" ? toPhilippineMobile(trimmed)
        : config.input === "badge" && isNup ? trimmed.replace(/\D/g, "")
          : config.input === "email" ? trimmed.toLowerCase()
            : trimmed;
  return value || null;
}

/** Field-specific checks the HR form also applies, on top of the shared request rules. */
function personalInputError(config: PersonalFieldConfig, value: string | null, isNup: boolean): string | null {
  if (value === null) return null;
  if (config.input === "phone" && !PHILIPPINE_MOBILE_PATTERN.test(value)) return "Enter the number as +639XXXXXXXXX.";
  if (config.input === "badge") {
    if (isNup) return /^\d{8}$/.test(value) ? null : "ID number must contain 8 digits.";
    return BADGE_NUMBER_PATTERN.test(value) ? null : "Badge number must be 6 digits in the format 0-00000.";
  }
  return null;
}

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
          : key === "rating"
            ? "Enter a rating from 0 to 100."
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
  const [personalErrors, setPersonalErrors] = useState<Partial<Record<PersonalField, string>>>({});
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
  // NUP personnel use an 8-digit ID number (shown as YYYY-MM-DD) instead of a badge number.
  const isNup = /^\d{8}$/.test(employeeData.employee_number ?? "");
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
    const contactChanges = PERSONAL_FIELD_CONFIGS.flatMap((config) => {
      if (!form.has(config.field)) return [];
      const originalValue = (employeeData[config.column] as string | null | undefined) ?? null;
      const requestedValue = normalizePersonalValue(config, String(form.get(config.field) ?? ""), isNup);
      return requestedValue === normalizePersonalValue(config, originalValue ?? "", isNup)
        ? []
        : [{ config, change: { kind: "contact" as const, field: config.field, originalValue, requestedValue } }];
    });
    const nextPersonalErrors: Partial<Record<PersonalField, string>> = {};
    for (const { config, change } of contactChanges) {
      const inputError = personalInputError(config, change.requestedValue, isNup);
      const parsed = profileChangeContactChangeSchema.safeParse(change);
      if (inputError) nextPersonalErrors[change.field] = inputError;
      else if (!parsed.success) nextPersonalErrors[change.field] = parsed.error.issues[0]?.message ?? "Check this value.";
    }
    setPersonalErrors(nextPersonalErrors);
    if (Object.keys(nextPersonalErrors).length) {
      setError("Check the highlighted personal details.");
      return;
    }
    const changes = [...contactChanges.map(({ change }) => change), ...qualificationChanges, ...certificationChanges, ...trainingChanges];
    if (!changes.length) {
      setError("Change at least one personal detail or add an eligibility, certification, or training change.");
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
      setSuccess("Request submitted. HR will review it; your official profile stays unchanged until then.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit your request.");
    }
  }
  return (
    <form className="max-w-3xl space-y-6" noValidate onSubmit={onSubmit}>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Correct any detail HR entered on your official record. Change only the fields that are wrong; HR is notified and your official profile stays unchanged until HR approves this request.
      </p>
      {PERSONAL_SECTIONS.map((section) => (
        <fieldset className="space-y-4" key={section.title}>
          <legend className="text-base font-semibold">{section.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((config) => (
              <FormField
                description={config.input === "badge" ? (isNup ? "8 digits displayed as YYYY-MM-DD." : "6 digits, e.g. 1-23456.") : undefined}
                error={personalErrors[config.field]}
                htmlFor={config.field}
                key={config.field}
                label={config.input === "badge" ? (isNup ? "ID number" : "Badge number") : PERSONAL_FIELD_LABELS[config.field]}
              >
                <PersonalFieldInput config={config} isNup={isNup} value={(employeeData[config.column] as string | null | undefined) ?? null} />
              </FormField>
            ))}
          </div>
        </fieldset>
      ))}
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
            <FormField description="Optional, e.g. 85 for 85%." error={qualificationErrors.rating} htmlFor="qualification-rating" label="Rating (%)">
              <Input id="qualification-rating" inputMode="decimal" max="100" min="0" onChange={(event) => changeQualificationField("rating", event.target.value)} step="0.01" type="number" value={qualification.rating} />
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

/** The input for one personal field, pre-filled with the value on the official record. */
function PersonalFieldInput({ config, isNup, value }: { config: PersonalFieldConfig; isNup: boolean; value: string | null }) {
  const { field } = config;
  const select = (choices: readonly { value: string; label: string }[], placeholder: string) => (
    <select className={nativeSelectClassName} defaultValue={value ?? ""} id={field} name={field}>
      <option value="">{placeholder}</option>
      {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      {value && !choices.some((choice) => choice.value === value) ? <option value={value}>{value}</option> : null}
    </select>
  );
  switch (config.input) {
    case "badge":
      return isNup ? <NupIdInput className="h-11 tabular-nums" defaultValue={value} id={field} name={field} /> : <BadgeNumberInput defaultValue={value} id={field} name={field} />;
    case "phone":
      return <PhoneInput autoComplete={field === "phone" ? "tel" : "off"} defaultValue={value} id={field} name={field} />;
    case "government":
      return config.government === "sss" || !config.government
        ? <Input autoComplete="off" className="h-11 tabular-nums" defaultValue={value ?? ""} id={field} inputMode="numeric" name={field} placeholder="10 digits" />
        : <GovernmentIdInput defaultValue={value} id={field} kind={config.government} name={field} />;
    case "gender":
      return select([{ value: "female", label: "Female" }, { value: "male", label: "Male" }], "Select a gender");
    case "civilStatus":
      return select(CIVIL_STATUS_CHOICES.map((choice) => ({ value: choice, label: capitalize(choice) })), "Select a civil status");
    case "religion":
      return select(RELIGIONS.map((choice) => ({ value: choice, label: choice })), "Select a religion");
    case "relationship":
      return select(EMERGENCY_CONTACT_RELATIONSHIPS.map((choice) => ({ value: choice, label: capitalize(choice) })), "Select relationship");
    case "date":
      return <Input className="h-11" defaultValue={value ?? ""} id={field} name={field} type="date" />;
    case "email":
      return <Input autoComplete="email" className="h-11" defaultValue={value ?? ""} id={field} name={field} type="email" />;
    default:
      return <Input autoComplete="off" className="h-11" defaultValue={value ?? ""} id={field} name={field} />;
  }
}
