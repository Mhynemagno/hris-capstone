"use client";

import { type FormEvent, useState } from "react";
import { HeartPulse, IdCard, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useUpdateMyGovernmentIds } from "@/hooks/use-personnel-records";
import { formatPhilHealthNumber, formatSssNumber } from "@/lib/government-ids";
import type { Employee } from "@/lib/types/database";
import { governmentIdsSchema } from "@/schemas/personnel-records";

import { InfoCard, InfoList } from "./profile-layout";

type GovernmentIdsCardProps = {
  employee: Pick<Employee, "sss_number" | "philhealth_number">;
  /** The employee may save their own numbers directly; HR edits them on the personnel record form. */
  canEdit?: boolean;
};

type FieldErrors = Partial<Record<"sssNumber" | "philhealthNumber", string>>;

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
          <FormField description="10 digits, e.g. 34-1234567-8" error={fieldErrors.sssNumber} htmlFor="sss-number" label="SSS number">
            <Input className="h-11" defaultValue={formatSssNumber(employee.sss_number)} id="sss-number" inputMode="numeric" name="sssNumber" />
          </FormField>
          <FormField description="12 digits, e.g. 12-345678901-2" error={fieldErrors.philhealthNumber} htmlFor="philhealth-number" label="PhilHealth number">
            <Input className="h-11" defaultValue={formatPhilHealthNumber(employee.philhealth_number)} id="philhealth-number" inputMode="numeric" name="philhealthNumber" />
          </FormField>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save government IDs"}</Button>
            <Button disabled={save.isPending} onClick={() => { setEditing(false); setFieldErrors({}); setError(null); }} type="button" variant="ghost">Cancel</Button>
          </div>
        </form>
      ) : (
        <InfoList rows={[
          { label: "SSS number", value: <span className="tabular-nums">{formatSssNumber(employee.sss_number) || "Not provided"}</span>, icon: IdCard },
          { label: "PhilHealth number", value: <span className="tabular-nums">{formatPhilHealthNumber(employee.philhealth_number) || "Not provided"}</span>, icon: HeartPulse },
        ]} />
      )}
      {notice ? <p className="mt-3 text-sm text-muted-foreground" role="status">{notice}</p> : null}
    </InfoCard>
  );
}
