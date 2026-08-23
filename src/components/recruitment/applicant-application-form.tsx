"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { useSubmitApplication } from "@/hooks/use-recruitment";

export function ApplicantApplicationForm({ jobId }: { jobId: number }) {
  const submit = useSubmitApplication();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(form: HTMLFormElement) {
    setError(null);
    const data = new FormData(form);
    const files = Array.from(data.getAll("documents")).filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.some((file) => file.type === "application/pdf" || /\.(pdf)$/i.test(file.name))) return setError("Attach a CV before submitting.");
    try {
      await submit.mutateAsync({ applicationId: crypto.randomUUID(), jobId, coverNote: String(data.get("coverNote") ?? ""), documents: files.map((file, index) => ({ kind: index === 0 ? "cv" as const : "credential" as const, file })) });
      form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not submit your application."); }
  }
  return <form className="space-y-4 rounded-xl border p-5" noValidate onSubmit={(event) => { event.preventDefault(); void onSubmit(event.currentTarget); }}><h2 className="font-semibold">Submit application</h2><FormField htmlFor="application-cover-note" label="Cover note"><textarea className="min-h-28 w-full rounded-lg border bg-background p-3" id="application-cover-note" name="coverNote" /></FormField><FormField htmlFor="application-documents" label="CV and credentials"><input accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" id="application-documents" multiple name="documents" type="file" /></FormField><p className="text-xs text-muted-foreground">Attach a CV first; you may include supporting credentials. Each file must be 10 MB or smaller.</p>{error ? <ErrorState message={error} /> : null}<button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={submit.isPending} type="submit">{submit.isPending ? "Submitting…" : "Submit application"}</button></form>;
}
