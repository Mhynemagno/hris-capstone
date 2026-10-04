"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveAnnouncement } from "@/hooks/use-public-site";
import type { Announcement } from "@/lib/types/database";
import { ANNOUNCEMENT_CATEGORIES, announcementSchema, type AnnouncementInput } from "@/schemas/public-site";

type AnnouncementFormValues = z.input<typeof announcementSchema>;

type HrAnnouncementFormProps = {
  announcement?: Announcement;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

export function HrAnnouncementForm({ announcement, onCancel, onSaved }: HrAnnouncementFormProps) {
  const save = useSaveAnnouncement();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AnnouncementFormValues, unknown, AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: announcement?.title ?? "",
      category: announcement?.category ?? "news",
      summary: announcement?.summary ?? "",
      body: announcement?.body ?? "",
    },
  });
  const errors = form.formState.errors;
  const idPrefix = announcement ? `announcement-${announcement.id}` : "announcement-new";

  async function submit(values: AnnouncementInput) {
    setError(null);
    try {
      const saved = await save.mutateAsync({ input: values, announcementId: announcement?.id });
      onSaved(announcement ? `${saved.title} was updated.` : `${saved.title} was saved as a draft.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The announcement could not be saved.");
    }
  }

  return (
    <form
      aria-label={announcement ? `Edit ${announcement.title}` : "New announcement"}
      className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm"
      noValidate
      onSubmit={form.handleSubmit(submit)}
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <FormField error={errors.title?.message} htmlFor={`${idPrefix}-title`} label="Title" required>
          <Input id={`${idPrefix}-title`} maxLength={150} required {...form.register("title")} />
        </FormField>
        <FormField error={errors.category?.message} htmlFor={`${idPrefix}-category`} label="Category" required>
          <NativeSelect id={`${idPrefix}-category`} {...form.register("category")}>
            {ANNOUNCEMENT_CATEGORIES.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField description="One or two sentences shown on the landing page card." error={errors.summary?.message} htmlFor={`${idPrefix}-summary`} label="Summary" required>
        <Textarea id={`${idPrefix}-summary`} maxLength={300} required rows={2} {...form.register("summary")} />
      </FormField>
      <FormField description="Plain text. Leave a blank line between paragraphs." error={errors.body?.message} htmlFor={`${idPrefix}-body`} label="Announcement text" required>
        <Textarea id={`${idPrefix}-body`} maxLength={10_000} required rows={10} {...form.register("body")} />
      </FormField>
      {error ? <ErrorState message={error} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={save.isPending} type="submit">{save.isPending ? "Saving…" : announcement ? "Save changes" : "Save draft"}</Button>
        <Button onClick={onCancel} type="button" variant="outline">Cancel</Button>
      </div>
    </form>
  );
}
