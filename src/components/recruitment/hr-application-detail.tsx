"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import type { ApplicationAiScore } from "@/lib/types/database";
import { useApplicationAiScores, useHireApplication, useMyApplication, useRetryApplicationAnalysis, useTransitionApplicationStatus } from "@/hooks/use-recruitment";
import { getApplicantDocumentUrl } from "@/queries/recruitment";
import type { ApplicationStatus } from "@/schemas/recruitment";

const statuses: ApplicationStatus[] = ["Submitted", "Under Review", "Shortlisted", "Interview", "Needs Revision", "Not Selected"];

function formatApplicantNumber(value: number | undefined) {
  if (value === undefined) return "Not available";
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}

function AnalysisRecommendation({ applicationId, score, onError }: { applicationId: string; score: ApplicationAiScore | undefined; onError: (message: string) => void }) {
  const retry = useRetryApplicationAnalysis();
  const isAnalyzing = score?.status === "queued" || score?.status === "processing";
  async function retryAnalysis() { onError(""); try { await retry.mutateAsync(applicationId); } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to retry analysis."); } }
  return <section aria-live="polite" className="rounded-xl border border-primary/30 bg-muted p-5"><h2 className="font-semibold">AI recommendation</h2><p className="mt-2 text-sm text-muted-foreground">HR makes the final decision. Recommendations never change an application status.</p>{isAnalyzing ? <p className="mt-4 text-sm font-medium">Analyzing application…</p> : null}{score?.status === "completed" ? <p className="mt-4 text-sm"><span className="font-medium">Score: {score.score}/100</span>{score.explanation ? ` — ${score.explanation}` : ""}</p> : null}{score?.status === "failed" ? <div className="mt-4 space-y-3"><p className="text-sm"><span className="font-medium">Analysis failed.</span> You can retry when the service is available.</p><button className="min-h-11 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60" disabled={retry.isPending} onClick={() => void retryAnalysis()} type="button">{retry.isPending ? "Retrying analysis…" : "Retry analysis"}</button></div> : null}{!score ? <p className="mt-4 text-sm text-muted-foreground">Not analyzed. This may be an application submitted before automatic analysis was enabled.</p> : null}</section>;
}

export function HrApplicationDetail({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const transition = useTransitionApplicationStatus();
  const hire = useHireApplication();
  const aiScores = useApplicationAiScores(applicationId);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("Under Review");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [hireOpen, setHireOpen] = useState(false);
  if (result.isLoading) return <LoadingState label="Loading application…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  if (!result.data) return <ErrorState message="This application is unavailable." />;
  const { application, history, documents } = result.data;
  const applicantNumber = (application as typeof application & { applicants?: { applicant_number?: number } }).applicants?.applicant_number;
  const canHire = application.status === "Shortlisted" || application.status === "Interview";
  async function updateStatus() { setError(null); try { await transition.mutateAsync({ applicationId, nextStatus, note: note.trim() || undefined }); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not update this application."); } }
  async function openDocument(id: string, path: string) { try { const url = await getApplicantDocumentUrl(path); if (url) setDocumentUrls((current) => ({ ...current, [id]: url })); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not open this document."); } }
  async function submitHire(form: HTMLFormElement) { setError(null); const data = new FormData(form); try { await hire.mutateAsync({ applicationId, badgeNumber: String(data.get("badgeNumber")), note: String(data.get("hireNote") || "") || undefined }); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not hire this applicant."); } }
  return <section className="max-w-3xl space-y-5"><div className="rounded-xl border p-5"><h1 className="text-2xl font-semibold">Application {application.id.slice(0, 8)}</h1><p className="mt-2 text-sm text-muted-foreground">Current status: {application.status}</p>{application.cover_note ? <p className="mt-4 whitespace-pre-wrap text-sm">{application.cover_note}</p> : null}</div>{aiScores.error ? <ErrorState message={aiScores.error.message} /> : <AnalysisRecommendation applicationId={applicationId} onError={(message) => setError(message || null)} score={aiScores.data?.[0]} />}<section className="rounded-xl border p-5"><h2 className="font-semibold">Review workflow</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><FormField htmlFor="next-status" label="Next status"><select className="h-11 w-full rounded-lg border bg-background px-3" id="next-status" onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} value={nextStatus}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></FormField><FormField htmlFor="transition-note" label="Note"><Input id="transition-note" onChange={(event) => setNote(event.target.value)} value={note} /></FormField></div><div className="mt-4 flex gap-3"><button className="min-h-11 rounded-lg border px-4 py-2 text-sm font-medium" disabled={transition.isPending} onClick={() => void updateStatus()} type="button">Update status</button>{canHire ? <button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => setHireOpen((open) => !open)} type="button">{hireOpen ? "Close hire form" : "Hire applicant"}</button> : null}</div></section>{hireOpen && canHire ? <form className="space-y-3 rounded-xl border p-5" noValidate onSubmit={(event) => { event.preventDefault(); void submitHire(event.currentTarget); }}><h2 className="text-lg font-semibold">Hire applicant</h2><div className="grid gap-3 sm:grid-cols-2"><FormField htmlFor="hire-applicant-number" label="Applicant number"><Input id="hire-applicant-number" readOnly value={formatApplicantNumber(applicantNumber)} /></FormField><FormField htmlFor="hire-badge-number" label="Badge number"><Input id="hire-badge-number" name="badgeNumber" required /></FormField></div><FormField htmlFor="hire-note" label="Notes"><textarea className="min-h-20 w-full rounded-lg border bg-background p-3" id="hire-note" name="hireNote" /></FormField><button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" disabled={hire.isPending} type="submit">Confirm hire</button></form> : null}<section className="rounded-xl border p-5"><h2 className="font-semibold">Documents</h2><ul className="mt-3 space-y-2 text-sm">{documents.map((document) => <li key={document.id}>{documentUrls[document.id] ? <a className="text-primary underline" href={documentUrls[document.id]} rel="noreferrer" target="_blank">{document.file_name}</a> : <button className="text-primary underline" onClick={() => void openDocument(document.id, document.object_path)} type="button">Open {document.file_name}</button>}</li>)}</ul></section><section className="rounded-xl border p-5"><h2 className="font-semibold">History</h2><ol className="mt-3 space-y-2 text-sm">{history.map((entry) => <li key={entry.id}>{entry.next_status}{entry.note ? ` — ${entry.note}` : ""}</li>)}</ol></section>{error ? <ErrorState message={error} /> : null}</section>;
}
