"use client";

import { useState } from "react";

import { BadgeNumberInput } from "@/components/ui/badge-number-input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationAiScore } from "@/lib/types/database";
import { formatDate } from "@/lib/format-date";
import { useAddApplicationRemark, useApplicationAiScores, useHireApplication, useMyApplication, useRetryApplicationAnalysis, useTransitionApplicationStatus } from "@/hooks/use-recruitment";
import { getApplicantDocumentUrl } from "@/queries/recruitment";
import { hiringDecisionSchema, type ApplicationStatus } from "@/schemas/recruitment";

import { documentKindLabels, historyEntryLabel } from "./application-status-tracker";
import { HrRequiredDocuments } from "./hr-required-documents";

/**
 * Review transitions HR can choose. private.transition_application_status
 * (supabase/migrations/20260906185626_recruitment_workflow_feedback.sql) also
 * accepts Needs Revision, but HR no longer offers it (tester feedback); an
 * application already in Needs Revision keeps and shows that status. Hiring is
 * a separate flow, open only once the applicant is For Training; Needs Revision,
 * Hired, and Not Selected have no HR review transitions. After the interview in
 * San Juan the cycle continues: Endorsed to Crame (BMI) → Neuro Exam → For
 * Training (supabase/migrations/20261006091000_applicant_post_interview_flow.sql).
 */
export const allowedNextStatuses: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  Submitted: ["Under Review"],
  "Under Review": ["Shortlisted", "Interview", "Not Selected"],
  Shortlisted: ["Interview", "Not Selected"],
  Interview: ["Endorsed to Crame", "Shortlisted", "Not Selected"],
  "Endorsed to Crame": ["Neuro Exam", "Not Selected"],
  "Neuro Exam": ["For Training", "Not Selected"],
  "For Training": ["Not Selected"],
  "Needs Revision": [],
  Hired: [],
  "Not Selected": [],
};

function formatApplicantNumber(value: number | undefined) {
  if (value === undefined) return "Not available";
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}

function AnalysisRecommendation({ applicationId, score, onError }: { applicationId: string; score: ApplicationAiScore | undefined; onError: (message: string) => void }) {
  const retry = useRetryApplicationAnalysis();
  const isAnalyzing = score?.status === "queued" || score?.status === "processing";
  async function retryAnalysis() { onError(""); try { await retry.mutateAsync(applicationId); } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to retry analysis."); } }
  return <section aria-live="polite" className="rounded-xl border border-primary/30 bg-muted p-5"><h2 className="font-semibold">AI recommendation</h2><p className="mt-2 text-sm text-muted-foreground">HR makes the final decision. Recommendations never change an application status.</p>{isAnalyzing ? <p className="mt-4 text-sm font-medium">Analyzing application…</p> : null}{score?.status === "completed" ? <p className="mt-4 text-sm"><span className="font-medium">Score: {score.score}/100</span>{score.explanation ? ` — ${score.explanation}` : ""}</p> : null}{score?.status === "failed" ? <div className="mt-4 space-y-3"><p className="text-sm">{score.failure_code === "timed_out" ? <><span className="font-medium">Analysis timed out.</span> The analysis service did not finish in time. You can retry now.</> : <><span className="font-medium">Analysis failed.</span> You can retry when the service is available.</>}</p><button className="min-h-11 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60" disabled={retry.isPending} onClick={() => void retryAnalysis()} type="button">{retry.isPending ? "Retrying analysis…" : "Retry analysis"}</button></div> : null}{!score ? <p className="mt-4 text-sm text-muted-foreground">Not analyzed. This may be an application submitted before automatic analysis was enabled.</p> : null}</section>;
}

export function HrApplicationDetail({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const transition = useTransitionApplicationStatus();
  const hire = useHireApplication();
  const addRemark = useAddApplicationRemark();
  const aiScores = useApplicationAiScores(applicationId);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | "">("");
  const [note, setNote] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [hireSuccess, setHireSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [hireOpen, setHireOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const [remarkSuccess, setRemarkSuccess] = useState<string | null>(null);
  if (result.isLoading) return <LoadingState label="Loading application…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  if (!result.data) return <ErrorState message="This application is unavailable." />;
  const { application, history, documents } = result.data;
  const applicantNumber = (application as typeof application & { applicants?: { applicant_number?: number } }).applicants?.applicant_number;
  const canHire = application.status === "For Training";
  const nextOptions = allowedNextStatuses[application.status] ?? [];
  const hasBmiProof = documents.some((document) => document.kind === "bmi_proof");
  async function saveRemark() {
    setRemarkError(null);
    setRemarkSuccess(null);
    if (!remark.trim()) {
      setRemarkError("Enter a remark.");
      return;
    }
    try {
      await addRemark.mutateAsync({ applicationId, remark: remark.trim() });
      setRemark("");
      setRemarkSuccess("Remark added. The applicant was notified.");
    } catch (cause) {
      setRemarkError(cause instanceof Error ? cause.message : "We could not add this remark.");
    }
  }
  async function updateStatus() {
    setError(null);
    setStatusError(null);
    setStatusSuccess(null);
    if (!nextStatus) {
      setStatusError("Choose the next status.");
      return;
    }
    try {
      await transition.mutateAsync({ applicationId, nextStatus, note: note.trim() || undefined });
      setStatusSuccess(`Status updated to ${nextStatus}.`);
      setNextStatus("");
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not update this application.");
    }
  }
  async function openDocument(id: string, path: string) { try { const url = await getApplicantDocumentUrl(path); if (url) setDocumentUrls((current) => ({ ...current, [id]: url })); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not open this document."); } }
  async function submitHire(form: HTMLFormElement) {
    setError(null);
    setHireSuccess(null);
    const data = new FormData(form);
    const input = hiringDecisionSchema.safeParse({ applicationId, badgeNumber: String(data.get("badgeNumber") ?? ""), note: String(data.get("hireNote") || "") || undefined });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Check the hire details.");
      return;
    }
    try {
      await hire.mutateAsync(input.data);
      setHireSuccess("Applicant hired. Their employee record has been created.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not hire this applicant.");
    }
  }
  return (
    <section className="max-w-3xl space-y-5">
      <PageHeader
        description={`Current status: ${application.status}`}
       
        meta={application.cover_note ? <p className="whitespace-pre-wrap text-sm">{application.cover_note}</p> : undefined}
        title={`Application ${application.id.slice(0, 8)}`}
      />
      {aiScores.error ? <ErrorState message={aiScores.error.message} /> : <AnalysisRecommendation applicationId={applicationId} onError={(message) => setError(message || null)} score={aiScores.data?.[0]} />}
      <section aria-labelledby="review-workflow-heading" className="rounded-xl border p-5">
        <h2 className="font-semibold" id="review-workflow-heading">Review workflow</h2>
        {nextOptions.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FormField description="Only the steps allowed from the current status are listed." error={statusError ?? undefined} htmlFor="next-status" label="Next status">
              <NativeSelect id="next-status" onChange={(event) => { setStatusError(null); setNextStatus(event.target.value as ApplicationStatus | ""); }} value={nextStatus}>
                <option value="">Choose next status</option>
                {nextOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </NativeSelect>
            </FormField>
            <FormField description="Included in the applicant's notification." htmlFor="transition-note" label="Note">
              <Textarea id="transition-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
            </FormField>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No review status changes are available from {application.status}.</p>
        )}
        {application.status === "Endorsed to Crame" ? (
          <p className="mt-3 text-sm" role="note">{hasBmiProof ? "The applicant uploaded proof of passing the BMI. Check it below before moving them to Neuro Exam." : "Waiting for the applicant to upload proof of passing the BMI. Neuro Exam opens once it is uploaded."}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {nextOptions.length ? (
            <Button disabled={transition.isPending} onClick={() => void updateStatus()} type="button" variant="outline">
              {transition.isPending ? "Updating status…" : "Update status"}
            </Button>
          ) : null}
          {canHire ? (
            <Button onClick={() => setHireOpen((open) => !open)} type="button">{hireOpen ? "Close hire form" : "Hire applicant"}</Button>
          ) : null}
          {statusSuccess && !transition.isPending ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{statusSuccess}</p> : null}
          {hireSuccess ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{hireSuccess}</p> : null}
        </div>
      </section>
      {hireOpen && canHire ? (
        <form className="space-y-3 rounded-xl border p-5" noValidate onSubmit={(event) => { event.preventDefault(); void submitHire(event.currentTarget); }}>
          <h2 className="text-lg font-semibold">Hire applicant</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="hire-applicant-number" label="Applicant number">
              <Input id="hire-applicant-number" readOnly value={formatApplicantNumber(applicantNumber)} />
            </FormField>
            <FormField description="6 digits, e.g. 1-23456." htmlFor="hire-badge-number" label="Badge number" required>
              <BadgeNumberInput id="hire-badge-number" name="badgeNumber" required />
            </FormField>
          </div>
          <FormField htmlFor="hire-note" label="Notes">
            <Textarea id="hire-note" maxLength={2000} name="hireNote" />
          </FormField>
          <Button disabled={hire.isPending} type="submit">{hire.isPending ? "Hiring…" : "Confirm hire"}</Button>
        </form>
      ) : null}
      <section aria-labelledby="remarks-heading" className="rounded-xl border p-5">
        <h2 className="font-semibold" id="remarks-heading">Progress remarks</h2>
        <p className="mt-1 text-sm text-muted-foreground">Record progress without changing the status, e.g. &ldquo;Passed the BMI at Crame.&rdquo; The applicant sees each remark and is notified.</p>
        <div className="mt-3 space-y-3">
          <FormField error={remarkError ?? undefined} htmlFor="application-remark" label="Remark">
            <Textarea id="application-remark" maxLength={2000} onChange={(event) => { setRemarkError(null); setRemark(event.target.value); }} rows={3} value={remark} />
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={addRemark.isPending} onClick={() => void saveRemark()} type="button" variant="outline">{addRemark.isPending ? "Adding remark…" : "Add remark"}</Button>
            {remarkSuccess && !addRemark.isPending ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{remarkSuccess}</p> : null}
          </div>
        </div>
      </section>
      <HrRequiredDocuments applicantId={application.applicant_id} />
      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">Submitted with this application</h2>
        {documents.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {documents.map((document) => (
              <li key={document.id}>
                <span className="text-muted-foreground">{documentKindLabels[document.kind]}</span> ·{" "}
                {documentUrls[document.id]
                  ? <a className="inline-flex min-h-10 items-center text-primary underline" href={documentUrls[document.id]} rel="noreferrer" target="_blank">{document.file_name}</a>
                  : <button className="inline-flex min-h-10 items-center text-primary underline" onClick={() => void openDocument(document.id, document.object_path)} type="button">Open {document.file_name}</button>}
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">No documents were attached.</p>}
      </section>
      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">History</h2>
        <ol className="mt-3 space-y-2 text-sm">{history.map((entry) => <li key={entry.id}><span className="text-muted-foreground">{formatDate(entry.created_at)}</span> · <span className="font-medium">{historyEntryLabel(entry)}</span>{entry.note ? ` — ${entry.note}` : ""}</li>)}</ol>
      </section>
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}
