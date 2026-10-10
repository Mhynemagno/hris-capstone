"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PNP_CERTIFICATION_GROUPS, PNP_CERTIFICATIONS, PNP_QUALIFICATIONS, PNP_TRAINING_PROVIDERS, PNP_TRAININGS, withSavedValue } from "@/lib/pnp-catalogue";
import { useUnitStations } from "@/hooks/use-personnel-records";
import type { Certification, Qualification, ServiceHistory, TrainingRecord } from "@/lib/types/database";
import type { PersonnelKind } from "@/queries/personnel-records";
import { certificationSchema, qualificationSchema, serviceHistorySchema, trainingRecordSchema } from "@/schemas/personnel-records";

import { DepartmentRankFields } from "./department-rank-fields";

const fields: Record<PersonnelKind, { title: string; primary?: string; secondary?: string; date: string; expiry?: string }> = {
  serviceHistory: { title: "Service history", date: "Start date", expiry: "End date" },
  qualification: { title: "Eligibility", primary: "Eligibility", date: "Date awarded" },
  certification: { title: "Certification / Training", primary: "Certification / Training", date: "Completion date" },
  training: { title: "Training", primary: "Course name", secondary: "Provider", date: "Completed date", expiry: "Expiry date" },
};

/** Dropdown choices for the name (and, for legacy training, the provider) of each credential record. */
const choices: Partial<Record<PersonnelKind, { primary: readonly string[]; secondary?: readonly string[] }>> = {
  qualification: { primary: PNP_QUALIFICATIONS },
  certification: { primary: PNP_CERTIFICATIONS },
  training: { primary: PNP_TRAININGS, secondary: PNP_TRAINING_PROVIDERS },
};

/** Maps schema field names back to the generic form controls they came from. */
const errorFieldFor: Record<string, string> = {
  name: "primary", courseName: "primary",
  notes: "notes", provider: "secondary",
  startedOn: "date", awardedOn: "date", issuedOn: "date", completedOn: "date",
  endedOn: "expiry", expiresOn: "expiry",
  departmentId: "departmentId", rankId: "rankId", hours: "hours", unitStation: "unitStation",
};

type RecordEntryFormProps = {
  employeeId: string;
  kind: PersonnelKind;
  /** `document` is the eligibility supporting document chosen in this form, if any. */
  onSaved: (input: unknown, id?: string, document?: File | null) => void | Promise<void>;
  pending?: boolean;
  training?: TrainingRecord;
  /** Optional existing qualification to edit. */
  qualification?: Qualification;
  /** Optional existing certification / training to edit. */
  certification?: Certification;
  /** Optional existing service history entry to edit. */
  serviceHistory?: ServiceHistory;
};

/** "an Eligibility", "a Certification / Training" — for "Select …" prompts. */
function article(noun = "") {
  const lower = noun.toLowerCase();
  return `${/^[aeiou]/.test(lower) ? "an" : "a"} ${lower}`;
}

/** Only the saved values that exist, so a new entry carries no hidden keys. */
function kept(values: Record<string, string | null | undefined>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value));
}

function text(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value : "";
}

export function RecordEntryForm({ employeeId, kind, onSaved, pending = false, training, qualification, certification, serviceHistory }: RecordEntryFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState(serviceHistory?.department_id ? String(serviceHistory.department_id) : "");
  const [rankId, setRankId] = useState(serviceHistory?.rank_id ? String(serviceHistory.rank_id) : "");
  const [startDate, setStartDate] = useState(training?.completed_on ?? qualification?.awarded_on ?? certification?.issued_on ?? serviceHistory?.started_on ?? "");
  const unitStations = useUnitStations();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const config = fields[kind];
  const kindChoices = choices[kind];
  const savedPrimary = training?.course_name ?? qualification?.name ?? certification?.name;
  const savedSecondary = training?.provider;
  const editing = kind === "training" ? training : kind === "qualification" ? qualification : kind === "certification" ? certification : serviceHistory;
  const editId = editing?.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    const form = Object.fromEntries(new FormData(formElement));
    // Updates write every column, so values this form does not show are carried through unchanged.
    const base = kind === "serviceHistory"
      ? { employeeId, departmentId: form.departmentId || undefined, rankId: form.rankId || undefined, unitStation: text(form.unitStation), ...kept({ employmentTitle: serviceHistory?.employment_title }), notes: text(form.notes), startedOn: form.date, endedOn: form.expiry || undefined }
      : kind === "qualification"
        ? { employeeId, name: form.primary, ...kept({ institution: qualification?.institution, qualificationLevel: qualification?.qualification_level, fieldOfStudy: qualification?.field_of_study }), awardedOn: form.date, notes: text(form.notes) }
        : kind === "certification"
          ? { employeeId, name: form.primary, ...kept({ issuer: certification?.issuer, credentialId: certification?.credential_id, expiresOn: certification?.expires_on }), issuedOn: form.date, notes: text(form.notes) }
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
        if (errors.primary && !text(form.primary)) errors.primary = `Select ${article(config.primary)}.`;
        if (errors.secondary && !text(form.secondary)) errors.secondary = `Select ${article(config.secondary)}.`;
      }
      setFieldErrors(errors);
      if (errors.form) setError(errors.form);
      return;
    }
    // Eligibility needs proof it was passed; an entry that already has a document keeps it unless replaced.
    if (kind === "qualification" && !documentFile && !qualification?.document_path) {
      setFieldErrors({ document: "Upload a supporting document showing you passed." });
      return;
    }
    try {
      if (kind === "qualification") await onSaved(parsed.data, editId, documentFile);
      else await onSaved(parsed.data, editId);
      setDocumentFile(null);
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
        <>
        <DepartmentRankFields
          departmentError={e.departmentId}
          departmentId={departmentId}
          departmentLabel="Unit / Section"
          departmentName="departmentId"
          departmentPlaceholder="Select a unit / section"
          idPrefix={`${kind}`}
          onDepartmentChange={setDepartmentId}
          onRankChange={setRankId}
          rankError={e.rankId}
          rankId={rankId}
          rankName="rankId"
          required
          savedDepartmentId={serviceHistory?.department_id}
          savedRankId={serviceHistory?.rank_id}
        />
          <FormField error={e.unitStation} htmlFor={`${kind}-unit-station`} label="Unit / Station">
            <NativeSelect key={unitStations.data ? "catalogue" : "loading"} defaultValue={serviceHistory?.unit_station ?? ""} id={`${kind}-unit-station`} name="unitStation">
              <option value="">Select a unit / station</option>
              {serviceHistory?.unit_station && !unitStations.data?.some((unit) => unit.name === serviceHistory.unit_station) ? <option value={serviceHistory.unit_station}>{serviceHistory.unit_station}</option> : null}
              {unitStations.data?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
            </NativeSelect>
          </FormField>
        </>
      ) : null}
      {config.primary ? (
        <FormField error={e.primary} htmlFor={`${kind}-primary`} label={config.primary} required>
          {kindChoices ? (
            <NativeSelect defaultValue={savedPrimary ?? ""} id={`${kind}-primary`} name="primary" required>
              <option value="">Select {article(config.primary)}</option>
              {kind === "certification" ? (
                <>
                  {withSavedValue(kindChoices.primary, savedPrimary).filter((choice) => !(PNP_CERTIFICATIONS as readonly string[]).includes(choice)).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                  {PNP_CERTIFICATION_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                    </optgroup>
                  ))}
                </>
              ) : withSavedValue(kindChoices.primary, savedPrimary).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </NativeSelect>
          ) : (
            <Input className="h-11" id={`${kind}-primary`} name="primary" required />
          )}
        </FormField>
      ) : null}
      {config.secondary ? (
        <FormField error={e.secondary} htmlFor={`${kind}-secondary`} label={config.secondary} required>
          <NativeSelect defaultValue={savedSecondary ?? ""} id={`${kind}-secondary`} name="secondary" required>
            <option value="">Select {article(config.secondary)}</option>
            {withSavedValue(kindChoices?.secondary ?? [], savedSecondary).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </NativeSelect>
        </FormField>
      ) : null}
      <FormField error={e.date} htmlFor={`${kind}-date`} label={config.date} required>
        <Input className="h-11" id={`${kind}-date`} name="date" onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
      </FormField>
      {config.expiry ? (
        <FormField error={e.expiry} htmlFor={`${kind}-expiry`} label={config.expiry}>
          <Input className="h-11" defaultValue={training?.expires_on ?? serviceHistory?.ended_on ?? ""} id={`${kind}-expiry`} min={startDate || undefined} name="expiry" type="date" />
        </FormField>
      ) : null}
      {kind === "training" ? (
        <FormField error={e.hours} htmlFor="training-hours" label="Hours">
          <Input className="h-11" defaultValue={training?.hours ?? ""} id="training-hours" max="9999.99" min="0" name="hours" step="0.25" type="number" />
        </FormField>
      ) : null}
      {kind === "qualification" ? (
        <div className="sm:col-span-2">
          <FormField
            description={qualification?.document_path ? `Current document: ${qualification.document_name}. Choose a file only to replace it.` : "Required. Proof the exam was passed (PDF or image, up to 10 MB)."}
            error={e.document}
            htmlFor="qualification-document"
            label="Supporting document"
            required={!qualification?.document_path}
          >
            <Input accept="application/pdf,image/png,image/jpeg,image/webp" className="h-11" id="qualification-document" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} type="file" />
          </FormField>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <FormField error={e.notes} htmlFor={`${kind}-notes`} label="Remarks">
          <Textarea defaultValue={training?.notes ?? qualification?.notes ?? certification?.notes ?? serviceHistory?.notes ?? ""} id={`${kind}-notes`} maxLength={2000} name="notes" />
        </FormField>
      </div>
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
