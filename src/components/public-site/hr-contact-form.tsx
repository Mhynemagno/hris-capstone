"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useSavePublicContact } from "@/hooks/use-public-site";
import type { PublicContact, PublicContactKind } from "@/lib/types/database";
import { PUBLIC_CONTACT_KINDS, publicContactSchema, type PublicContactInput } from "@/schemas/public-site";

type ContactFormValues = z.input<typeof publicContactSchema>;

const valueHints: Record<PublicContactKind, string> = {
  phone: "Digits, spaces, +, ( ) and - only, for example (02) 8123 4567. One number per entry.",
  email: "For example name@example.com.",
  address: "Street, barangay and city. Line breaks are kept.",
  hours: "For example Monday to Friday, 8:00 AM to 5:00 PM.",
  facebook: "The full page link, starting with https://www.facebook.com/.",
};

type HrContactFormProps = {
  contact?: PublicContact;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

export function HrContactForm({ contact, onCancel, onSaved }: HrContactFormProps) {
  const save = useSavePublicContact();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ContactFormValues, unknown, PublicContactInput>({
    resolver: zodResolver(publicContactSchema),
    defaultValues: { kind: contact?.kind ?? "phone", label: contact?.label ?? "", value: contact?.value ?? "", isVisible: contact?.is_visible ?? true },
  });
  const kind = useWatch({ control: form.control, name: "kind" }) ?? "phone";
  const errors = form.formState.errors;
  const idPrefix = contact ? `contact-${contact.id}` : "contact-new";

  async function submit(values: PublicContactInput) {
    setError(null);
    try {
      const saved = await save.mutateAsync({ input: values, contactId: contact?.id });
      onSaved(contact ? `${saved.label} was updated.` : `${saved.label} was added.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The contact could not be saved.");
    }
  }

  return (
    <form aria-label={contact ? `Edit ${contact.label}` : "New contact"} className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm" noValidate onSubmit={form.handleSubmit(submit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField error={errors.kind?.message} htmlFor={`${idPrefix}-kind`} label="Type" required>
          <NativeSelect id={`${idPrefix}-kind`} {...form.register("kind")}>
            {PUBLIC_CONTACT_KINDS.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField description="Shown above the value, for example HR Office." error={errors.label?.message} htmlFor={`${idPrefix}-label`} label="Label" required>
          <Input id={`${idPrefix}-label`} maxLength={80} required {...form.register("label")} />
        </FormField>
      </div>
      <FormField description={valueHints[kind]} error={errors.value?.message} htmlFor={`${idPrefix}-value`} label="Contact details" required>
        <Input id={`${idPrefix}-value`} maxLength={300} required {...form.register("value")} />
      </FormField>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold" htmlFor={`${idPrefix}-visible`}>
        <input className="size-5 accent-primary" id={`${idPrefix}-visible`} type="checkbox" {...form.register("isVisible")} />
        Show on the public landing page
      </label>
      {error ? <ErrorState message={error} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : "Save contact"}</Button>
        <Button onClick={onCancel} type="button" variant="outline">Cancel</Button>
      </div>
    </form>
  );
}
