"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  PNP_CERTIFICATIONS,
  PNP_FIELDS_OF_STUDY,
  PNP_INSTITUTIONS,
  PNP_ISSUERS,
  PNP_QUALIFICATIONS,
  PNP_TRAINING_PROVIDERS,
  PNP_TRAININGS,
  withSavedValue,
} from "@/lib/pnp-catalogue";
import type { Qualification, TrainingRecord } from "@/lib/types/database";
import type { PersonnelKind } from "@/queries/personnel-records";
import { certificationSchema, QUALIFICATION_LEVELS, qualificationSchema, serviceHistorySchema, trainingRecordSchema } from "@/schemas/personnel-records";

import { DepartmentRankFields } from "./department-rank-fields";

const fields: Record<PersonnelKind, { title: string; primary: string; secondary: string; date: string; expiry?: string }> = {
  serviceHistory: { title: "Service history", primary: "Employment title", secondary: "Notes", date: "Start date", expiry: "End date" },
  qualification: { title: "Qualification", primary: "Qualification name", secondary: "Institution", date: "Awarded date" },
  certification: { title: "Certification", primary: "Certificate name", secondary: "Issuer", date: "Issued date", expiry: "Expiry date" },
  training: { title: "Training", primary: "Course name", secondary: "Provider", date: "Completed date", expiry: "Expiry date" },
};

/** Dropdown choices for the name and awarding-body fields of each credential record. */
const choices: Partial<Record<PersonnelKind, { primary: readonly string[]; secondary: readonly string[] }>> = {
  qualification: { primary: PNP_QUALIFICATIONS, secondary: PNP_INSTITUTIONS },
  certification: { primary: PNP_CERTIFICATIONS, secondary: PNP_ISSUERS },
  training: { primary: PNP_TRAININGS, secondary: PNP_TRAINING_PROVIDERS },
};

/** Maps schema field names back to the generic form controls they came from. */
const errorFieldFor: Record<string, string> = {
  employmentTitle: "primary", name: "primary", courseName: "primary",
  notes: "notes", institution: "secondary", issuer: "secondary", provider: "secondary",
  startedOn: "date", awardedOn: "date", issuedOn: "date", completedOn: "date",
  endedOn: "expiry", expiresOn: "expiry",
  departmentId: "departmentId", rankId: "rankId", qualificationLevel: "qualificationLevel",
  fieldOfStudy: "fieldOfStudy", credentialId: "credentialId", hours: "hours",
};

type RecordEntryFormProps = {
  employeeId: string;
  kind: PersonnelKind;
  onSaved: (input: unknown, id?: string) => void | Promise<void>;
  pending?: boolean;
  training?: TrainingRecord;
  /** Optional existing qualification to edit. */
  qualification?: Qualification;
};

function text(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value : "";
}

export function RecordEntryForm({ employeeId, kind, onSaved, pending = false, training, qualification }: RecordEntryFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [rankId, setRankId] = useState("");
  const [startDate, setStartDate] = useState(training?.completed_on ?? qualification?.awarded_on ?? "");
  const config = fields[kind];
  const kindChoices = choices[kind];
  const savedPrimary = training?.course_name ?? qualification?.name;
  const savedSecondary = training?.provider ?? qualification?.institution;
  const isTrainingEdit = kind === "training" && Boolean(training);
  const isQualificationEdit = kind === "qualification" && Boolean(qualification);
  const editId = isTrainingEdit ? training?.id : isQualificationEdit ? qualification?.id : undefined;
  const savedLevel = qualification?.qualification_level ?? "";
  const levelChoices: string[] = savedLevel && !(QUALIFICATION_LEVELS as readonly string[]).includes(savedLevel)
    ? [savedLevel, ...QUALIFICATION_LEVELS]
    : [...QUALIFICATION_LEVELS];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    const form = Object.fromEntries(new FormData(formElement));
    const base = kind === "serviceHistory"
      ? { employeeId, departmentId: form.departmentId || undefined, rankId: form.rankId || undefined, employmentTitle: text(form.primary), notes: text(form.notes), startedOn: form.date, endedOn: form.expiry || undefined }
      : kind === "qualification"
        ? { employeeId, name: form.primary, institution: form.secondary, qualificationLevel: text(form.qualificationLevel), fieldOfStudy: text(form.fieldOfStudy), awardedOn: form.date }
        : kind === "certification"
          ? { employeeId, name: form.primary, issuer: form.secondary, issuedOn: form.date, expiresOn: form.expiry || undefined }
          : { employeeId, courseName: form.primary, provider: form.secondary, completedOn: form.date, expiresOn: form.expiry || undefined, hours: form.hours || undefined, notes: text(form.notes) };
    const schema = kind === "serviceHistory" ? serviceHistorySchema : kind === "qualification" ? qualificationSchema : kind === "certification" ? certificationSchema : trainingRecordSchema;
    const parsed = schema.safeParse(base);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = errorFieldFor[String(issue.path[0])] ?? "form";
        errors[key] ??= issue.message;
      }
      // Dropdowns fail only when nothing was chosen, so say that instead of a length rule.
      if (kindChoices) {
        if (errors.primary && !text(form.primary)) errors.primary = `Select a ${config.primary.toLowerCase()}.`;
        if (errors.secondary && !text(form.secondary)) errors.secondary = `Select a ${config.secondary.toLowerCase()}.`;
      }
      setFieldErrors(errors);
      if (errors.form) setError(errors.form);
      return;
    }
    try {
      await onSaved(parsed.data, editId);
      if (!editId) {
        formElement.reset();
        setDepartmentId("");
        setRankId("");
        setStartDate("");
      }
      setSuccess(editId ? `${config.title} saved.` : `${config.title} added.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save this record.");
    }
  }

  const e = fieldErrors;
  const isServiceHistory = kind === "serviceHistory";

  return (
    <form className="mt-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2" noValidate onSubmit={submit}>
      {isServiceHistory ? (
        <DepartmentRankFields
          departmentError={e.departmentId}
          departmentId={departmentId}
          departmentName="departmentId"
          idPrefix={`${kind}`}
          onDepartmentChange={setDepartmentId}
          onRankChange={setRankId}
          rankError={e.rankId}
          rankId={rankId}
          rankName="rankId"
        />
      ) : null}
      <FormField
        description={isServiceHistory ? "Optional. Use when the assignment title differs from the rank." : undefined}
        error={e.primary}
        htmlFor={`${kind}-primary`}
        label={config.primary}
        required={!isServiceHistory}
      >
        {kindChoices ? (
          <NativeSelect defaultValue={savedPrimary ?? ""} id={`${kind}-primary`} name="primary" required>
            <option value="">Select a {config.primary.toLowerCase()}</option>
            {withSavedValue(kindChoices.primary, savedPrimary).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </NativeSelect>
        ) : (
          <Input className="h-11" id={`${kind}-primary`} name="primary" />
        )}
      </FormField>
      {!isServiceHistory ? (
        <FormField error={e.secondary} htmlFor={`${kind}-secondary`} label={config.secondary} required>
          <NativeSelect defaultValue={savedSecondary ?? ""} id={`${kind}-secondary`} name="secondary" required>
            <option value="">Select a {config.secondary.toLowerCase()}</option>
            {withSavedValue(kindChoices?.secondary ?? [], savedSecondary).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </NativeSelect>
        </FormField>
      ) : null}
      {kind === "qualification" ? (
        <>
          <FormField error={e.qualificationLevel} htmlFor="qualification-level" label="Qualification level">
            <NativeSelect defaultValue={savedLevel} id="qualification-level" name="qualificationLevel">
              <option value="">Not specified</option>
              {levelChoices.map((level) => <option key={level} value={level}>{level}</option>)}
            </NativeSelect>
          </FormField>
          <FormField error={e.fieldOfStudy} htmlFor="qualification-field-of-study" label="Field of study">
            <NativeSelect defaultValue={qualification?.field_of_study ?? ""} id="qualification-field-of-study" name="fieldOfStudy">
              <option value="">Not specified</option>
              {withSavedValue(PNP_FIELDS_OF_STUDY, qualification?.field_of_study).map((field) => <option key={field} value={field}>{field}</option>)}
            </NativeSelect>
          </FormField>
        </>
      ) : null}
      <FormField error={e.date} htmlFor={`${kind}-date`} label={config.date} required>
        <Input className="h-11" id={`${kind}-date`} name="date" onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
      </FormField>
      {config.expiry ? (
        <FormField error={e.expiry} htmlFor={`${kind}-expiry`} label={config.expiry}>
          <Input className="h-11" defaultValue={training?.expires_on ?? ""} id={`${kind}-expiry`} min={startDate || undefined} name="expiry" type="date" />
        </FormField>
      ) : null}
      {kind === "training" ? (
        <FormField error={e.hours} htmlFor="training-hours" label="Hours">
          <Input className="h-11" defaultValue={training?.hours ?? ""} id="training-hours" max="9999.99" min="0" name="hours" step="0.25" type="number" />
        </FormField>
      ) : null}
      {isServiceHistory || kind === "training" ? (
        <div className="sm:col-span-2">
          <FormField error={e.notes} htmlFor={`${kind}-notes`} label="Notes">
            <Textarea defaultValue={training?.notes ?? ""} id={`${kind}-notes`} maxLength={2000} name="notes" />
          </FormField>
        </div>
      ) : null}
      {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button className="h-11 w-full sm:w-auto" disabled={pending} type="submit">
          {pending ? "Saving…" : editId ? `Save ${config.title.toLowerCase()}` : `Add ${config.title.toLowerCase()}`}
        </Button>
        {success && !pending ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{success}</p> : null}
      </div>
    </form>
  );
}
