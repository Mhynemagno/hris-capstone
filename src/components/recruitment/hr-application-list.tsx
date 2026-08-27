"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrApplications } from "@/hooks/use-recruitment";

export function HrApplicationList() {
  const [aiStatus, setAiStatus] = useState<"" | "queued" | "processing" | "completed" | "failed" | "unscored">("");
  const [minimumScore, setMinimumScore] = useState("");
  const applications = useHrApplications({ page: 1, pageSize: 100, aiStatus: aiStatus || undefined, minimumScore: minimumScore ? Number(minimumScore) : undefined });
  if (applications.isLoading) return <LoadingState label="Loading applications…" />;
  if (applications.error) return <ErrorState message={applications.error.message} />;
  const rows = applications.data?.rows ?? [];
  return <section className="space-y-4"><div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><label className="text-sm">AI analysis status<select aria-label="AI analysis status" className="mt-1 h-10 w-full rounded-lg border bg-background px-3" onChange={(event) => setAiStatus(event.target.value as typeof aiStatus)} value={aiStatus}><option value="">All results</option><option value="queued">Queued</option><option value="processing">Analyzing</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="unscored">Not analyzed</option></select></label><label className="text-sm">Minimum AI score<input aria-label="Minimum AI score" className="mt-1 h-10 w-full rounded-lg border bg-background px-3" max="100" min="0" onChange={(event) => setMinimumScore(event.target.value)} type="number" value={minimumScore} /></label></div>{!rows.length ? <p className="rounded-xl border p-5 text-sm text-muted-foreground">There are no applications to review.</p> : <div className="space-y-3">{rows.map((application) => <Link className="block rounded-xl border p-4 hover:bg-muted" href={`/hr/applications/${application.id}`} key={application.id}><div className="flex items-center justify-between gap-3"><span className="font-medium">Application {application.id.slice(0, 8)}</span><span className="rounded-full bg-muted px-2 py-1 text-xs">{application.status}</span></div><p className="mt-1 text-sm text-muted-foreground">Submitted {new Date(application.submitted_at).toLocaleDateString()}</p><p className="mt-2 text-sm">AI recommendation: {application.ai_score_status === "completed" ? `${application.ai_score}/100` : application.ai_score_status === "unscored" ? "Not analyzed" : "Analyzing application…"}</p></Link>)}</div>}</section>;
}
