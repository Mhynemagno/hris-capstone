"use client";

import { FileText } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { Textarea } from "@/components/ui/textarea";
import { useDeploymentReports, useSubmitDeploymentReport } from "@/hooks/use-deployment-tracking";
import { formatDateTime } from "@/lib/format-date";
import { openSignedUrl } from "@/lib/open-signed-url";
import { getDeploymentReportUrl } from "@/queries/deployment-tracking";

/** Reports / proof of attendance for one deployment: the list, and a form to submit one (deployed employee or HR). */
export function DeploymentReports({ deploymentId }: { deploymentId: string }) {
  const reports = useDeploymentReports(deploymentId);
  const submit = useSubmitDeploymentReport();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!file) {
      setError("Attach the report or proof of attendance.");
      return;
    }
    const form = event.currentTarget;
    try {
      await submit.mutateAsync({ deploymentId, notes: notes.trim() || undefined, file });
      form.reset();
      setFile(null);
      setNotes("");
      setNotice("Report submitted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not submit the report.");
    }
  }

  return (
    <section aria-labelledby={`deployment-reports-${deploymentId}`} className="space-y-3">
      <h2 className="text-xl font-bold" id={`deployment-reports-${deploymentId}`}>Reports / proof of attendance</h2>
      {reports.isLoading ? <LoadingState label="Loading reports…" /> : reports.error ? <ErrorState message={reports.error.message} /> : reports.data?.length ? (
        <ul className="space-y-2">
          {reports.data.map((report) => (
            <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between" key={report.id}>
              <div>
                <p className="font-medium">{report.file_name}</p>
                {report.notes ? <p className="text-muted-foreground">{report.notes}</p> : null}
                <p className="text-muted-foreground">{formatDateTime(report.created_at)}</p>
              </div>
              <Button aria-label={`View ${report.file_name}`} onClick={() => void openSignedUrl(() => getDeploymentReportUrl(report.object_path)).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to open the report."))} size="sm" type="button" variant="outline"><FileText aria-hidden />View</Button>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">No report submitted yet.</p>}
      <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" noValidate onSubmit={onSubmit}>
        <FormField description="A short report, attendance sheet, or photo (PDF or image, up to 10 MB)." htmlFor={`report-file-${deploymentId}`} label="Report or proof of attendance" required>
          <Input accept="application/pdf,image/png,image/jpeg,image/webp" className="h-11" id={`report-file-${deploymentId}`} onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
        </FormField>
        <FormField htmlFor={`report-notes-${deploymentId}`} label="Notes">
          <Textarea id={`report-notes-${deploymentId}`} maxLength={2000} onChange={(event) => setNotes(event.target.value)} rows={2} value={notes} />
        </FormField>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button disabled={submit.isPending} type="submit">{submit.isPending ? "Submitting…" : "Submit report"}</Button>
          {notice ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice}</p> : null}
        </div>
        {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
      </form>
    </section>
  );
}
