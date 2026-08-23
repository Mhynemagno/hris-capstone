"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useApplicationAiScores, useHireApplication, useMyApplication, useRequestApplicationAnalysis, useTransitionApplicationStatus } from "@/hooks/use-recruitment";
import { getApplicantDocumentUrl } from "@/queries/recruitment";
import type { ApplicationStatus } from "@/schemas/recruitment";

const statuses: ApplicationStatus[] = ["Submitted", "Under Review", "Shortlisted", "Interview", "Hired", "Not Selected"];

export function HrApplicationDetail({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const transition = useTransitionApplicationStatus();
  const hire = useHireApplication();
  const aiScores = useApplicationAiScores(applicationId);
  const analyze = useRequestApplicationAnalysis();
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("Under Review");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [cvText, setCvText] = useState("");
  const [confirmedAnonymized, setConfirmedAnonymized] = useState(false);

  if (result.isLoading) return <LoadingState label="Loading application…" />;
  if (result.error) return <ErrorState message={result.error.message} />;
  if (!result.data) return <ErrorState message="This application is unavailable." />;
  const { application, history, documents } = result.data;
  async function updateStatus() {
    setError(null);
    try { await transition.mutateAsync({ applicationId, nextStatus, note: note.trim() || undefined }); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not update this application."); }
  }
  async function openDocument(documentId: string, objectPath: string) {
    try { const url = await getApplicantDocumentUrl(objectPath); if (url) setDocumentUrls((current) => ({ ...current, [documentId]: url })); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not open this document."); }
  }
  async function submitHire(form: HTMLFormElement) {
    setError(null);
    const data = new FormData(form);
    try { await hire.mutateAsync({ applicationId, employeeNumber: String(data.get("employeeNumber")), departmentId: Number(data.get("departmentId")), positionId: Number(data.get("positionId")), employmentStartedOn: String(data.get("employmentStartedOn")), note: String(data.get("hireNote") || "") || undefined }); } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not hire this applicant."); }
  }

  const latestScore = aiScores.data?.[0];
  return <section className="max-w-3xl space-y-5"><div className="rounded-xl border p-5"><h1 className="text-2xl font-semibold">Application {application.id.slice(0, 8)}</h1><p className="mt-2 text-sm text-muted-foreground">Current status: {application.status}</p>{application.cover_note ? <p className="mt-4 whitespace-pre-wrap text-sm">{application.cover_note}</p> : null}</div><section className="rounded-xl border border-primary/30 bg-muted p-5"><h2 className="font-semibold">AI recommendation</h2><p className="mt-2 text-sm">HR makes the final decision. AI scores are recommendations only and never change an application status.</p>{latestScore?.status === "completed" ? <p className="mt-3 text-sm">Score: {latestScore.score}/100 — {latestScore.explanation}</p> : null}<FormField htmlFor="ai-cv-text" label="Approved anonymized CV text"><textarea className="min-h-32 w-full rounded-lg border bg-background p-3" id="ai-cv-text" onChange={(event) => setCvText(event.target.value)} value={cvText} /></FormField><label className="mt-3 flex gap-2 text-sm"><input checked={confirmedAnonymized} onChange={(event) => setConfirmedAnonymized(event.target.checked)} type="checkbox" />I confirm this text is anonymized and approved for AI analysis</label><button className="mt-3 rounded-lg border px-4 py-2 text-sm font-medium" disabled={!confirmedAnonymized || cvText.trim().length < 80 || analyze.isPending} onClick={() => void analyze.mutateAsync({ applicationId, cvText, confirmedAnonymized: true }).then(() => { setCvText(""); setConfirmedAnonymized(false); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to score this application."))} type="button">Analyze application</button></section><section className="rounded-xl border p-5"><h2 className="font-semibold">Review workflow</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><FormField htmlFor="next-status" label="Next status"><select className="h-11 w-full rounded-lg border bg-background px-3" id="next-status" onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} value={nextStatus}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></FormField><FormField htmlFor="transition-note" label="Note"><Input id="transition-note" onChange={(event) => setNote(event.target.value)} value={note} /></FormField></div><button className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium" disabled={transition.isPending} onClick={() => void updateStatus()} type="button">Update status</button></section>{nextStatus === "Hired" ? <form className="space-y-3 rounded-xl border p-5" noValidate onSubmit={(event) => { event.preventDefault(); void submitHire(event.currentTarget); }}><h2 className="text-lg font-semibold">Hire applicant</h2><div className="grid gap-3 sm:grid-cols-2"><FormField htmlFor="hire-employee-number" label="Employee number"><Input id="hire-employee-number" name="employeeNumber" /></FormField><FormField htmlFor="hire-department" label="Department ID"><Input id="hire-department" min="1" name="departmentId" type="number" /></FormField><FormField htmlFor="hire-position" label="Position ID"><Input id="hire-position" min="1" name="positionId" type="number" /></FormField><FormField htmlFor="hire-started-on" label="Employment start date"><Input id="hire-started-on" name="employmentStartedOn" type="date" /></FormField></div><FormField htmlFor="hire-note" label="Decision note"><textarea className="min-h-20 w-full rounded-lg border bg-background p-3" id="hire-note" name="hireNote" /></FormField><button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" disabled={hire.isPending} type="submit">Confirm hire</button></form> : null}<section className="rounded-xl border p-5"><h2 className="font-semibold">Documents</h2><ul className="mt-3 space-y-2 text-sm">{documents.map((document) => <li key={document.id}>{documentUrls[document.id] ? <a className="text-primary underline" href={documentUrls[document.id]} rel="noreferrer" target="_blank">{document.file_name}</a> : <button className="text-primary underline" onClick={() => void openDocument(document.id, document.object_path)} type="button">Open {document.file_name}</button>}</li>)}</ul></section><section className="rounded-xl border p-5"><h2 className="font-semibold">History</h2><ol className="mt-3 space-y-2 text-sm">{history.map((entry) => <li key={entry.id}>{entry.next_status}{entry.note ? ` — ${entry.note}` : ""}</li>)}</ol></section>{error ? <ErrorState message={error} /> : null}</section>;
}
