"use client";

import { type FormEvent, useState } from "react";
import { HeartPulse, IdCard, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { GovernmentIdInput } from "@/components/ui/government-id-input";
import { useUpdateMyGovernmentIds } from "@/hooks/use-personnel-records";
import { formatGovernmentId } from "@/lib/government-ids";
import type { Employee } from "@/lib/types/database";
import { governmentIdsSchema } from "@/schemas/personnel-records";

import { InfoCard, InfoList } from "./profile-layout";

type GovernmentIdsCardProps = {
  employee: Pick<Employee, "philhealth_number" | "gsis_number" | "pagibig_number">;
  /** The employee may save their own numbers directly; HR edits them on the personnel record form. */
  canEdit?: boolean;
};

type FieldErrors = Partial<Record<"philhealthNumber" | "gsisNumber" | "pagibigNumber", string>>;

export function GovernmentIdsCard({ employee, canEdit = false }: GovernmentIdsCardProps) {
  const save = useUpdateMyGovernmentIds();
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = governmentIdsSchema.safeParse(form);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) errors[issue.path[0] as keyof FieldErrors] ??= issue.message;
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    try {
      await save.mutateAsync(parsed.data);
      setEditing(false);
      setNotice("Government IDs saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your government IDs.");
    }
  }

  const editButton = canEdit && !editing
    ? <Button aria-label="Edit government IDs" onClick={() => { setEditing(true); setNotice(null); }} size="sm" type="button" variant="outline"><Pencil aria-hidden="true" />Edit</Button>
    : null;

  return (
    <InfoCard action={editButton} icon={IdCard} id="profile-government-ids" title="Government IDs">
      {editing ? (
        <form className="space-y-4" noValidate onSubmit={submit}>
          <FormField error={fieldErrors.philhealthNumber} htmlFor="self-philhealth-number" label="PhilHealth number">
            <GovernmentIdInput defaultValue={employee.philhealth_number} id="self-philhealth-number" kind="philhealth" name="philhealthNumber" />
          </FormField>
          <FormField error={fieldErrors.gsisNumber} htmlFor="self-gsis-number" label="GSIS number">
            <GovernmentIdInput defaultValue={employee.gsis_number} id="self-gsis-number" kind="gsis" name="gsisNumber" />
          </FormField>
          <FormField error={fieldErrors.pagibigNumber} htmlFor="self-pagibig-number" label="Pag-IBIG number">
            <GovernmentIdInput defaultValue={employee.pagibig_number} id="self-pagibig-number" kind="pagibig" name="pagibigNumber" />
          </FormField>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save government IDs"}</Button>
            <Button disabled={save.isPending} onClick={() => { setEditing(false); setFieldErrors({}); setError(null); }} type="button" variant="ghost">Cancel</Button>
          </div>
        </form>
      ) : (
        <InfoList rows={[
          { label: "PhilHealth number", value: <span className="tabular-nums">{formatGovernmentId("philhealth", employee.philhealth_number) || "Not provided"}</span>, icon: HeartPulse },
          { label: "GSIS number", value: <span className="tabular-nums">{formatGovernmentId("gsis", employee.gsis_number) || "Not provided"}</span>, icon: IdCard },
          { label: "Pag-IBIG number", value: <span className="tabular-nums">{formatGovernmentId("pagibig", employee.pagibig_number) || "Not provided"}</span>, icon: IdCard },
        ]} />
      )}
      {notice ? <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
    </InfoCard>
  );
}
