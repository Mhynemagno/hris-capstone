"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePublishedJob } from "@/hooks/use-recruitment";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function PublicJobDetail({ jobId }: { jobId: number }) {
  const job = usePublishedJob(jobId);
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    void createBrowserSupabaseClient().auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
  }, []);
  if (job.isLoading) return <LoadingState label="Loading job opening…" />;
  if (job.error) return <ErrorState message={job.error.message} />;
  if (!job.data) return <ErrorState message="This job opening is unavailable or has closed." />;
  const criteria = [...(job.data.job_qualification_criteria ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  return <section className="mx-auto max-w-3xl space-y-6"><div><Link className="text-sm text-primary underline-offset-4 hover:underline" href="/jobs">All job openings</Link><p className="mt-4 text-sm text-muted-foreground">{job.data.location || "Location to be confirmed"}</p><h1 className="text-3xl font-semibold tracking-tight">{job.data.title}</h1><p className="mt-4 whitespace-pre-wrap text-muted-foreground">{job.data.description}</p></div><div className="rounded-xl border p-5"><h2 className="font-semibold">Qualification criteria</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{criteria.map((criterion) => <li key={criterion.id}><span className="font-medium">{criterion.is_required ? "Required" : "Preferred"}:</span> {criterion.requirement}</li>)}</ul></div><div className="flex flex-wrap gap-3"><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={isSignedIn ? `/applicant/applications?jobId=${job.data.id}` : "/login"}>{isSignedIn ? "Apply for this opening" : "Sign in to apply"}</Link>{!isSignedIn ? <Link className="rounded-lg border px-4 py-2 text-sm font-medium" href="/applicant/register">Create applicant account</Link> : null}</div></section>;
}
