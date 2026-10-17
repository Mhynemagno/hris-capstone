"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useApplicationAiScores, useRetryApplicationAnalysis } from "@/hooks/use-recruitment";
import { formatDateTime } from "@/lib/format-date";
import type { ApplicantProfileDocument, ApplicationStatusHistory } from "@/lib/types/database";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

export type ProfileDocument = Pick<ApplicantProfileDocument, "id" | "kind" | "file_name" | "object_path" | "updated_at">;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card p-5">
      <h3 className="mb-3 text-base font-semibold" id={id}>{title}</h3>
      {children}
    </section>
  );
}

function AiMatchCard({ applicationId }: { applicationId: string }) {
  const scores = useApplicationAiScores(applicationId);
  const retry = useRetryApplicationAnalysis();
  const [error, setError] = useState<string | null>(null);
  const score = scores.data?.[0];
  const analyzing = score?.status === "queued" || score?.status === "processing";

  async function retryAnalysis() {
    setError(null);
    try { await retry.mutateAsync(applicationId); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to retry analysis."); }
  }

  return (
    <Section id="ai-match-heading" title="AI match">
      <div aria-live="polite" className="space-y-2">
        {scores.error ? <ErrorState message={scores.error.message} /> : null}
        {score?.status === "completed" ? <p className="text-base"><span className="text-2xl font-semibold tabular-nums">{score.score}/100</span>{score.explanation ? <span className="mt-1 block text-secondary-foreground">{score.explanation}</span> : null}</p> : null}
        {analyzing ? <p className="text-muted-foreground">Analyzing application…</p> : null}
        {score?.status === "failed" ? (
          <div className="space-y-3">
            <p>{score.failure_code === "timed_out" ? "Analysis timed out." : "Analysis failed."}</p>
            <Button loading={retry.isPending} onClick={() => void retryAnalysis()} size="sm" variant="outline">Retry analysis</Button>
          </div>
        ) : null}
        {!score && !scores.error ? <p className="text-muted-foreground">Not analyzed. This may be an application submitted before automatic analysis was enabled.</p> : null}
        {error ? <ErrorState message={error} /> : null}
      </div>
    </Section>
  );
}

export function OverviewTab({ applicationId, history, onShowDocuments, profileDocuments }: { applicationId: string; history: ApplicationStatusHistory[]; profileDocuments: ProfileDocument[]; onShowDocuments: () => void }) {
  const uploaded = APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => profileDocuments.some((document) => document.kind === kind));
  const missing = APPLICANT_PROFILE_DOCUMENT_KINDS.filter(({ kind }) => !profileDocuments.some((document) => document.kind === kind));
  const latestRemark = history.filter((entry) => entry.previous_status === entry.next_status && entry.note).at(-1);
  return (
    <div className="space-y-4">
      <AiMatchCard applicationId={applicationId} />
      <Section id="documents-summary-heading" title="Documents">
        <p className="text-base">{uploaded.length} of {APPLICANT_PROFILE_DOCUMENT_KINDS.length} required documents uploaded</p>
        {missing.length ? <p className="mt-1 text-sm text-warning">Missing: {missing.map(({ label }) => label).join(", ")}</p> : null}
        <Button className="mt-3" onClick={onShowDocuments} size="sm" variant="outline">View documents</Button>
      </Section>
      {latestRemark ? (
        <Section id="latest-remark-heading" title="Latest remark">
          <p className="text-base">{latestRemark.note}</p>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(latestRemark.created_at)}</p>
        </Section>
      ) : null}
    </div>
  );
}
