"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { NativeSelect } from "@/components/ui/native-select";
import { useHrApplications } from "@/hooks/use-recruitment";
import type { HrShortlistApplication } from "@/lib/types/database";

type AiStatusFilter = "" | "queued" | "processing" | "completed" | "failed" | "unscored";

function aiRecommendation(application: HrShortlistApplication) {
  if (application.ai_score_status === "completed") return `${application.ai_score}/100`;
  if (application.ai_score_status === "failed") return "Analysis failed";
  if (application.ai_score_status === "unscored") return "Not analyzed";
  return "Analyzing application…";
}

export function HrApplicationList() {
  const [aiStatus, setAiStatus] = useState<AiStatusFilter>("");
  const [minimumScore, setMinimumScore] = useState("");
  const scoreValue = minimumScore === "" ? undefined : Math.min(100, Math.max(0, Number(minimumScore)));
  const applications = useHrApplications({ page: 1, pageSize: 100, aiStatus: aiStatus || undefined, minimumScore: Number.isFinite(scoreValue) ? scoreValue : undefined });
  const hasFilters = Boolean(aiStatus || minimumScore);

  const filters = (
    <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <FormField htmlFor="application-ai-status" label="AI analysis status">
        <NativeSelect id="application-ai-status" onChange={(event) => setAiStatus(event.target.value as AiStatusFilter)} value={aiStatus}>
          <option value="">All results</option>
          <option value="queued">Queued</option>
          <option value="processing">Analyzing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="unscored">Not analyzed</option>
        </NativeSelect>
      </FormField>
      <FormField description="0 to 100" htmlFor="application-minimum-score" label="Minimum AI score">
        <Input id="application-minimum-score" inputMode="numeric" max="100" min="0" onChange={(event) => setMinimumScore(event.target.value)} type="number" value={minimumScore} />
      </FormField>
      <Button disabled={!hasFilters} onClick={() => { setAiStatus(""); setMinimumScore(""); }} type="button" variant="outline">Clear filters</Button>
    </div>
  );

  if (applications.isLoading) return <section className="space-y-4">{filters}<LoadingState label="Loading applications…" /></section>;
  if (applications.error) return <section className="space-y-4">{filters}<ErrorState message={applications.error.message} /></section>;
  const rows = applications.data?.rows ?? [];

  return (
    <section className="space-y-4">
      {filters}
      <p aria-live="polite" className="text-sm text-muted-foreground">{rows.length === 1 ? "1 application" : `${rows.length} applications`}</p>
      <div className="relative overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Applications awaiting HR review</caption>
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Application</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Status</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Submitted</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">AI recommendation</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((application) => (
              <tr className="border-t" key={application.id}>
                <td className="px-4 py-3 align-top font-medium">Application {application.id.slice(0, 8)}</td>
                <td className="px-4 py-3 align-top"><Badge variant="secondary">{application.status}</Badge></td>
                <td className="px-4 py-3 align-top">{new Date(application.submitted_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 align-top">{aiRecommendation(application)}</td>
                <td className="px-4 py-3 align-top text-right">
                  <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/hr/applications/${application.id}`}>
                    Review{" "}<span className="sr-only">application {application.id.slice(0, 8)}</span>
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={5}>
                  {hasFilters ? "No applications match these filters. Clear the filters to see every application." : "There are no applications to review."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
